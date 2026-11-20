import { EXTENSION_DISPLAY_NAME } from './scripts/config';
import { getWebsiteAccess, getWebsiteGrants, intersectGrant } from './scripts/site-access';
import type {
	AllowedWebsite,
	SyncSettings,
	WebsiteChange,
	WebsiteRequest,
	WebsiteResponse
} from './scripts/types';

// The ID of the context menu item used to trigger the extension
const CONTEXT_MENU_ITEM_ID = 'sensitive-data-masker';

// The ID of the persistent registration for the masking script
const MASKING_SCRIPT_ID = 'sensitive-data-masker';

chrome.runtime.onInstalled.addListener(() => {
	// Add context menu item for selecting/populating form via right-click
	chrome.contextMenus.create({
		id: CONTEXT_MENU_ITEM_ID,
		title: EXTENSION_DISPLAY_NAME,
		contexts: ['page', 'editable', 'selection']
	});
});

// Open the extension popup when the user chooses its context menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === CONTEXT_MENU_ITEM_ID && tab?.id) {
		chrome.action.openPopup();
	}
});

// The most recent task in the queue for website changes and script registration
let websiteTask: Promise<void> = Promise.resolve();

// Run website tasks in order so a delayed update can't overwrite newer rules
function queueWebsiteTask(task: () => Promise<void>): Promise<void> {
	// The queued operation still reports its own failure to the caller
	const result = websiteTask.then(task);
	websiteTask = result.catch(() => {});
	return result;
}

// Return the latest masking rules saved by this extension
async function readWebsites(): Promise<AllowedWebsite[]> {
	return (await chrome.storage.sync.get<SyncSettings>('allowedWebsites')).allowedWebsites ?? [];
}

// Register the masking script where a browser grant and an enabled rule overlap
async function syncMaskingScript(): Promise<void> {
	// The current rules, Chrome grants, and matching registration (if it exists)
	const [websites, { origins = [] }, [registration]] = await Promise.all([
		readWebsites(),
		chrome.permissions.getAll(),
		chrome.scripting.getRegisteredContentScripts({ ids: [MASKING_SCRIPT_ID] })
	]);
	// The unique patterns that can use the same content script registration
	const matches = new Set<string>();
	for (const website of websites) {
		// The scope of this enabled rule, if Chrome can represent it
		const access = website.enabled && getWebsiteAccess(website.pattern);
		if (!access) continue;
		for (const origin of origins) {
			// The part of the rule this Chrome permission covers
			const match = intersectGrant(access.match, origin);
			if (match) matches.add(match);
		}
	}

	if (!matches.size) {
		if (registration) await chrome.scripting.unregisterContentScripts({ ids: [MASKING_SCRIPT_ID] });
		return;
	}

	// The registration to keep across browser restarts
	const script: chrome.scripting.RegisteredContentScript = {
		id: MASKING_SCRIPT_ID,
		js: ['content-script.js'],
		matches: Array.from(matches),
		runAt: 'document_idle',
		persistAcrossSessions: true
	};
	if (!registration) {
		await chrome.scripting.registerContentScripts([script]);
	} else if (
		registration.matches?.length !== matches.size ||
		!registration.matches.every((match) => matches.has(match))
	) {
		await chrome.scripting.updateContentScripts([script]);
	}
}

// Save a change against the latest list and release any grants it no longer uses
async function changeWebsite(change: WebsiteChange): Promise<void> {
	// The saved rules before the edit
	const websites = await readWebsites();
	if (change.action === 'add') {
		await chrome.storage.sync.set<SyncSettings>({ allowedWebsites: [...websites, change.website] });
		return;
	}

	// The row to update or remove
	const previous = websites.find((website) => website.id === change.id);
	if (!previous) return;
	// The rules after the change, including disabled rules
	const updated =
		change.action === 'remove'
			? websites.filter((website) => website.id !== change.id)
			: websites.map((website) =>
					website.id === change.id ? { ...website, ...change.changes } : website
				);
	await chrome.storage.sync.set<SyncSettings>({ allowedWebsites: updated });

	if (change.action === 'update' && change.changes.pattern === undefined) return;
	// The latest rules and grants in case Chrome Sync updated the list during the edit
	const [current, { origins = [] }] = await Promise.all([
		readWebsites(),
		chrome.permissions.getAll()
	]);
	// The grants previously used by the changed rule that no saved rule still uses
	const unused = getWebsiteGrants(previous.pattern, origins).filter((grant) =>
		current.every((website) => !getWebsiteGrants(website.pattern, [grant]).length)
	);
	if (unused.length) await chrome.permissions.remove({ origins: unused });
}

// Bring the registration up to date after a browser or storage event
function scheduleScriptSync(): void {
	void queueWebsiteTask(syncMaskingScript).catch((error) =>
		console.error('Could not update the masking script', error)
	);
}

chrome.runtime.onInstalled.addListener(scheduleScriptSync);
chrome.runtime.onStartup.addListener(scheduleScriptSync);
chrome.permissions.onAdded.addListener(scheduleScriptSync);
chrome.permissions.onRemoved.addListener(scheduleScriptSync);

// Sync registration when this profile receives a new version of the saved rules
chrome.storage.onChanged.addListener((changes, area) => {
	if (area === 'sync' && changes.allowedWebsites) scheduleScriptSync();
});

// Apply options changes and acknowledge them after the registration is current
chrome.runtime.onMessage.addListener((request: WebsiteRequest, _sender, respond) => {
	if (!['changeWebsite', 'revokeWebsiteAccess', 'syncMaskingScript'].includes(request.type)) return;
	void queueWebsiteTask(async () => {
		if (request.type === 'changeWebsite') await changeWebsite(request.change);
		if (request.type === 'revokeWebsiteAccess') {
			await chrome.permissions.remove({ origins: request.grants });
		}
		await syncMaskingScript();
	}).then(
		() => respond({ ok: true } satisfies WebsiteResponse),
		(error: unknown) =>
			respond({
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			} satisfies WebsiteResponse)
	);
	return true;
});
