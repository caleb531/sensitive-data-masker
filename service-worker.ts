import { EXTENSION_DISPLAY_NAME } from './scripts/config';

// The ID of the context menu item used to trigger the extension
const CONTEXT_MENU_ITEM_ID = 'sensitive-data-masker';

chrome.runtime.onInstalled.addListener((object) => {
	// Add context menu item for selecting/populating form via right-click
	chrome.contextMenus.create({
		id: CONTEXT_MENU_ITEM_ID,
		title: EXTENSION_DISPLAY_NAME,
		contexts: ['page', 'editable', 'selection']
	});
});

// When the user chooses the extension's context menu item, send a message to
// the content script to fill the form
chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === CONTEXT_MENU_ITEM_ID && tab?.id) {
		chrome.action.openPopup();
	}
});
