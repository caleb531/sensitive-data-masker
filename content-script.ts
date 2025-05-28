import type { AllowedWebsite, DataTypeId } from './scripts/types';

// A rule representing a pattern to match and a substitution function to apply
interface ReplacementRule {
	pattern: RegExp;
	substitution: (...args: string[]) => string;
	dataTypeId: DataTypeId;
}

// All replacement rules built into the extension; these rules dictate what the
// extension will mask on a given webpage
const replacementRules: ReplacementRule[] = [
	{
		// Monentary amount with currency symbol
		pattern: /(\$|€|£|¥|₹|₩|₽|₺|₪)(\d+,?)+((\.\d{2,})|(\.\d{1,2}(K|M|B|T)?))?(?!\.)\b/gi,
		substitution: ($0, $1) => `${$1}x.xx`,
		dataTypeId: 'currency'
	},
	{
		// Monetary amount without currency symbol
		pattern: /\b(?<!\.)(\d+,?)+((\.\d{2,})|(\.\d{1,2}(K|M|B|T)?))(?!\s*[\.\%])\b/gi,
		substitution: () => 'x.xx',
		dataTypeId: 'currency'
	},
	{
		// Percentage value
		pattern: /\b((\d+,?)+(\.\d+)?(K|M|B|T)?)\s*(%)/gi,
		substitution: () => 'x%',
		dataTypeId: 'percentage'
	},
	{
		// Social security number
		pattern: /\b(\d{3})-(\d{2})-(\d{4})\b/gi,
		substitution: () => 'xxx-xx-xxxx',
		dataTypeId: 'socialSecurityNumber'
	},
	{
		// 16-digit credit card number (e.g. Visa, Mastercard, Discover)
		pattern: /\b(\d{4})(-|\s+)?(\d{4})(-|\s+)?(\d{4})(-|\s+)?(\d{4})\b/gi,
		substitution: () => 'xxxx-xxxx-xxxx-xxxx',
		dataTypeId: 'creditCardNumber'
	},
	{
		// 15-digit credit card number (e.g. American Express)
		pattern: /\b(\d{4})-(\d{6})-(\d{5})\b/gi,
		substitution: () => 'xxxx-xxxxxx-xxxxx',
		dataTypeId: 'creditCardNumber'
	}
];

// Recursively walk element and its descendants, and for any leaf node whose
// textContent matches any of the designated patterns, mask the value
function maskValuesInNodeTree(
	node: Node,
	dataTypePreferences: Partial<Record<DataTypeId, boolean>>
) {
	if (
		node.nodeType === Node.TEXT_NODE &&
		node.textContent &&
		// Do not process scripts or styles
		node.parentElement?.nodeName !== 'SCRIPT' &&
		node.parentElement?.nodeName !== 'STYLE'
	) {
		const currentTextContent = node.textContent;
		replacementRules.some((replacementRule) => {
			if (
				(dataTypePreferences[replacementRule.dataTypeId] ?? true) &&
				replacementRule.pattern.test(currentTextContent)
			) {
				node.textContent = currentTextContent.replace(
					replacementRule.pattern,
					replacementRule.substitution
				);
				// Fall through to returning false because the same node may contain
				// multiple data types that require replacement
			}
			return false;
		});
	} else if (node.nodeType === Node.ELEMENT_NODE) {
		// Recursively process elements to find text nodes
		node.childNodes.forEach((childNode) => {
			maskValuesInNodeTree(childNode, dataTypePreferences);
		});
	}
}

// Return true if the given website URL matches one of the allowed website
// patterns; wildcards (e.g. *.example.com) are allowed
function websiteIsAllowed(currentUrl: Location | URL, allowedWebsites: AllowedWebsite[]) {
	return allowedWebsites.some((website) => {
		if (!website.enabled) {
			return false;
		}
		if (!website.pattern.trim()) {
			return false;
		}
		const escapedWebsitePattern = website.pattern
			// Escape special regex characters
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			// Replace wildcards (*) with the proper regex pattern to match any
			// character except a dot
			.replace(/\\\*/g, '[^\\.\\/]*');
		const regex = new RegExp(`^${escapedWebsitePattern}$`);
		return regex.test(currentUrl.href) || regex.test(currentUrl.hostname);
	});
}

async function main() {
	const allowedWebsites = (await chrome.storage.sync.get('allowedWebsites'))?.allowedWebsites ?? [];
	const dataTypePreferences =
		(await chrome.storage.sync.get('dataTypePreferences'))?.dataTypePreferences ?? {};
	if (!websiteIsAllowed(location, allowedWebsites)) {
		return;
	}
	// Check the page for sensitive data when the DOM is first loaded (which is
	// guaranteed because the default runAt value for content scripts is
	// "document_idle", which guarantees the DOM is complete by the time the
	// content script runs; for more details, see the table in
	// <https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#run_time>)
	maskValuesInNodeTree(document.body, dataTypePreferences);
	// Recheck page for sensitive data when DOM changes
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === 'childList') {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						maskValuesInNodeTree(node, dataTypePreferences);
					}
				});
			} else if (mutation.type === 'characterData') {
				maskValuesInNodeTree(mutation.target, dataTypePreferences);
			}
		});
	});
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true
	});
}
main();

// Reload the page when instructed by the Options popup
chrome.runtime.onMessage.addListener((message) => {
	if (message.type === 'reloadPage') {
		window.location.reload();
	}
});
