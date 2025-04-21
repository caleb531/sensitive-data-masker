import type { AllowedWebsite } from './scripts/types';

// A rule representing a pattern to match and a substitution function to apply
interface ReplacementRule {
	pattern: RegExp;
	substitution: (...args: string[]) => string;
}

// All replacement rules built into the extension; these rules dictate what the
// extension will mask on a given webpage
const replacementRules: ReplacementRule[] = [
	{
		// Currency value with symbol
		pattern: /(\$|€|£|¥)\s*((?:\d+,?)+(?:\.\d{1,2})?(?:K|M|B|T)?)/gi,
		substitution: (_, $1) => `${$1 ?? ''}x.xx`
	},
	{
		// Currency value without symbol
		pattern: /((?:\d+,?)+(?:\.\d{1,2})(?:K|M|B|T)?)/gi,
		substitution: () => `x.xx`
	},
	{
		// Percentage value
		pattern: /((?:\d+,?)+(?:\.\d{1,2})?(?:K|M|B|T)?)\s*(%)/gi,
		substitution: (_, $1) => `x.xx${$1 ?? ''}`
	},
	{
		// Social security number
		pattern: /(\d{3})-(\d{2})-(\d{4})/gi,
		substitution: () => `xxx-xx-xxxx`
	}
];

// Recursively walk element and its descendants, and for any leaf node whose
// textContent matches any of the designated patterns, mask the value
function maskValuesInNodeTree(node: Node) {
	if (
		node.nodeType === Node.TEXT_NODE &&
		node.textContent &&
		// Do not process scripts or styles
		node.parentElement?.nodeName !== 'SCRIPT' &&
		node.parentElement?.nodeName !== 'STYLE'
	) {
		const currentTextContent = node.textContent;
		replacementRules.some((replacementRule) => {
			if (replacementRule.pattern.test(currentTextContent)) {
				node.textContent = currentTextContent.replace(
					replacementRule.pattern,
					replacementRule.substitution
				);
				return true; // Stop after the first match
			}
			return false;
		});
	} else if (node.nodeType === Node.ELEMENT_NODE) {
		// Recursively process elements to find text nodes
		node.childNodes.forEach((childNode) => {
			maskValuesInNodeTree(childNode);
		});
	}
}

const observer = new MutationObserver((mutations) => {
	mutations.forEach((mutation) => {
		if (mutation.type === 'childList') {
			mutation.addedNodes.forEach((node) => {
				if (node.nodeType === Node.ELEMENT_NODE) {
					maskValuesInNodeTree(node);
				}
			});
		}
	});
});

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
	if (!websiteIsAllowed(location, allowedWebsites)) {
		return;
	}
	// Check the page for sensitive data when the DOM is first loaded (which is
	// guaranteed because the default runAt value for content scripts is
	// "document_idle", which guarantees the DOM is complete by the time the
	// content script runs; for more details, see the table in
	// <https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#run_time>)
	maskValuesInNodeTree(document.body);
	// Recheck page for sensitive data when DOM changes
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true
	});
}
main();
