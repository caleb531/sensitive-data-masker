// Regular expressions representing sensitive data values, like currency values,
// credit card numbers, etc.
const sensitiveDataPattern =
	/(\$|€|£|¥)\s*((?:\d+,?)+(?:\.\d{1,2})?(?:K|M|B|T)?)|((?:\d+,?)+(?:\.\d{1,2})?(?:K|M|B|T)?)\s*(%)/gi;

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
		if (sensitiveDataPattern.test(node.textContent)) {
			node.textContent = node.textContent.replace(sensitiveDataPattern, ($0, $1, $2, $3, $4) => {
				return `${$1 ?? ''}x.xx${$4 ?? ''}`;
			});
		}
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

// Check the page for sensitive data when the DOM is first loaded
document.addEventListener('DOMContentLoaded', () => {
	maskValuesInNodeTree(document.body);
});
// Recheck page for sensitive data when DOM changes
observer.observe(document.body, {
	childList: true,
	subtree: true,
	characterData: true
});
