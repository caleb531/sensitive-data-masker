const patterns = {
	currencyValue: /\s?((\d,?)+(\.\d{1,2})?(?:K|M|B|T)?)/gi
};

const observer = new MutationObserver((mutations) => {
	mutations.forEach((mutation) => {
		// Recursively walk element and its children, and for any leaf node whose textContent matches the currencyValue pattern, replace it with '$x.xx'
		const walk = (node: Node) => {
			if (node.nodeType === Node.TEXT_NODE && node.textContent) {
				const match = node.textContent.match(patterns.currencyValue);
				if (match) {
					console.log('mutation', node);
					node.textContent = node.textContent.replace(patterns.currencyValue, 'x.xx');
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				node.childNodes.forEach((childNode) => {
					walk(childNode);
				});
			}
		};
		if (mutation.type === 'childList') {
			mutation.addedNodes.forEach((node) => {
				if (node.nodeType === Node.ELEMENT_NODE) {
					walk(node);
				}
			});
		}
	});
});

console.log(document.body);
observer.observe(document.body, {
	childList: true,
	subtree: true,
	characterData: true
});
