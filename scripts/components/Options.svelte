<script lang="ts">
	import { EXTENSION_DISPLAY_NAME } from '../config';
	import { getWebsiteAccess, getWebsiteGrants } from '../site-access';
	import type {
		AllowedWebsite,
		DataType,
		DataTypeId,
		WebsiteChange,
		WebsiteRequest,
		WebsiteResponse
	} from '../types';
	import ReloadPrompt from './ReloadPrompt.svelte';
	import RemoveIcon from './RemoveIcon.svelte';
	import Switch from './Switch.svelte';

	// The maskable data types that the extension supports out of the box
	export const dataTypes = [
		{
			id: 'currency',
			label: 'Monetary amounts'
		},
		{
			id: 'percentage',
			label: 'Percentages'
		},
		{
			id: 'socialSecurityNumber',
			label: 'Social security numbers'
		},
		{
			id: 'creditCardNumber',
			label: 'Credit card numbers'
		}
	] as const;

	// Data types that can be masked
	const dataTypePreferences: Partial<Record<DataTypeId, boolean>> = $state({});

	// The rules saved in Chrome Sync and the blank rows still being entered
	let allowedWebsites: AllowedWebsite[] = $state([]);
	const draftWebsites: AllowedWebsite[] = $state([]);

	// The browser's current grants for this profile
	let origins: string[] = $state([]);

	// The rows waiting for a save, and the website whose access is being changed
	const savingWebsites: Record<string, boolean> = $state({});
	let changingAccess = $state(false);

	// The shared grant that the user is reviewing before revoking access
	let confirmRevokeId: string | undefined = $state();

	// The most recent error from a website or permission action
	let websiteError = $state('');

	// Control when the reload banner prompt is visible
	let reloadPromptVisible = $state(false);

	// Ask the service worker to save a change or update the script registration
	async function sendWebsiteRequest(request: WebsiteRequest): Promise<void> {
		// The result after the worker has applied the change
		const response: WebsiteResponse = await chrome.runtime.sendMessage(request);
		if (!response.ok) throw new Error(response.error);
	}

	// Refresh grants from Chrome after an in-app or browser-side permission change
	async function refreshOrigins(): Promise<void> {
		try {
			origins = (await chrome.permissions.getAll()).origins ?? [];
		} catch {
			websiteError = 'Could not read website access from Chrome.';
		}
	}

	// Save one rule and keep the reload prompt available if the page uses it
	async function saveWebsite(change: WebsiteChange): Promise<void> {
		// The row whose controls are waiting for the save
		const id = change.action === 'add' ? change.website.id : change.id;
		savingWebsites[id] = true;
		websiteError = '';
		try {
			await sendWebsiteRequest({ type: 'changeWebsite', change });
			reloadPromptVisible = true;
		} catch (error) {
			websiteError = error instanceof Error ? error.message : 'Could not save the website.';
		} finally {
			delete savingWebsites[id];
		}
	}

	// Add a blank row and save it when the user finishes entering a rule
	function addNewWebsite(): void {
		draftWebsites.push({ id: crypto.randomUUID(), pattern: '', enabled: true });
	}

	// Save the hostname from the tab the user opened the popup on
	async function addCurrentWebsite(): Promise<void> {
		// The active tab's URL is available when the popup was invoked on it
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!tab?.url || !/^https?:\/\//.test(tab.url)) {
			websiteError = 'Open the toolbar popup on an HTTP or HTTPS page to add that site.';
			return;
		}
		await saveWebsite({
			action: 'add',
			website: { id: crypto.randomUUID(), pattern: new URL(tab.url).host, enabled: true }
		});
	}

	// Discard a blank row or remove a saved rule
	function removeWebsite(id: string): void {
		// The position of this row if it has never been saved
		const draft = draftWebsites.findIndex((website) => website.id === id);
		if (draft !== -1) {
			draftWebsites.splice(draft, 1);
		} else {
			void saveWebsite({ action: 'remove', id });
		}
	}

	// Save a new or edited rule when the user leaves the field or presses Enter
	function updateWebsite(website: AllowedWebsite, input: HTMLInputElement): void {
		// The entered rule without surrounding whitespace
		const pattern = input.value.trim();
		input.value = pattern;
		if (pattern === website.pattern) return;
		if (!pattern) {
			removeWebsite(website.id);
		} else if (draftWebsites.some(({ id }) => id === website.id)) {
			void saveWebsite({ action: 'add', website: { ...website, pattern } });
		} else {
			void saveWebsite({ action: 'update', id: website.id, changes: { pattern } });
		}
	}

	// Request access directly from the button click so Chrome can show its prompt
	async function allowWebsiteAccess(origin: string): Promise<void> {
		changingAccess = true;
		websiteError = '';
		try {
			if (await chrome.permissions.request({ origins: [origin] })) {
				await sendWebsiteRequest({ type: 'syncMaskingScript' });
				reloadPromptVisible = true;
			} else {
				websiteError = 'Website access was not granted.';
			}
		} catch (error) {
			websiteError = error instanceof Error ? error.message : 'Could not request website access.';
		} finally {
			await refreshOrigins();
			changingAccess = false;
		}
	}

	// Revoke the grants shown on the row and keep its saved masking rule
	async function revokeWebsiteAccess(grants: string[]): Promise<void> {
		changingAccess = true;
		confirmRevokeId = undefined;
		websiteError = '';
		try {
			await sendWebsiteRequest({ type: 'revokeWebsiteAccess', grants });
			reloadPromptVisible = true;
		} catch (error) {
			websiteError = error instanceof Error ? error.message : 'Could not revoke website access.';
		} finally {
			await refreshOrigins();
			changingAccess = false;
		}
	}

	function toggleDataType(dataType: DataType) {
		dataTypePreferences[dataType.id] = !dataTypePreferences[dataType.id];
		chrome.storage.sync.set(
			{
				get dataTypePreferences() {
					return dataTypePreferences;
				}
			},
			() => {
				reloadPromptVisible = true;
				console.log('Saved data types!');
			}
		);
	}

	// Reload the page when the reload prompt is clicked
	async function handleReloadPromptClicked() {
		try {
			// The tab to reload, which may not have received the masking script yet
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (tab?.id === undefined) return;
			await sendWebsiteRequest({ type: 'syncMaskingScript' });
			await chrome.tabs.reload(tab.id);
			reloadPromptVisible = false;
		} catch (error) {
			websiteError = error instanceof Error ? error.message : 'Could not reload the page.';
		}
	}

	// Autofocus new input when added
	function autofocus(node: HTMLElement, condition: boolean) {
		if (condition) {
			node.focus();
		}
	}

	// Initially loaded websites list from Chrome storage
	let isLoading = $state(true);
	$effect(() => {
		// Refresh the list when a change is saved in this or another extension view
		function updateSavedWebsites(
			changes: Record<string, chrome.storage.StorageChange>,
			area: string
		) {
			if (area !== 'sync' || !changes.allowedWebsites) return;
			allowedWebsites = changes.allowedWebsites.newValue ?? [];
			// Drop the draft once its saved row appears in the list
			for (let index = draftWebsites.length - 1; index >= 0; index--) {
				if (allowedWebsites.some(({ id }) => id === draftWebsites[index].id)) {
					draftWebsites.splice(index, 1);
				}
			}
		}

		chrome.storage.onChanged.addListener(updateSavedWebsites);
		chrome.permissions.onAdded.addListener(refreshOrigins);
		chrome.permissions.onRemoved.addListener(refreshOrigins);
		window.addEventListener('focus', refreshOrigins);
		void Promise.all([
			chrome.storage.sync.get(['allowedWebsites', 'dataTypePreferences']),
			refreshOrigins()
		])
			.then(([result]) => {
				allowedWebsites = result.allowedWebsites ?? [];
				Object.assign(dataTypePreferences, result.dataTypePreferences);
			})
			.catch(() => (websiteError = 'Could not load the saved websites.'))
			.finally(() => (isLoading = false));
		return () => {
			chrome.storage.onChanged.removeListener(updateSavedWebsites);
			chrome.permissions.onAdded.removeListener(refreshOrigins);
			chrome.permissions.onRemoved.removeListener(refreshOrigins);
			window.removeEventListener('focus', refreshOrigins);
		};
	});
</script>

<ReloadPrompt visible={reloadPromptVisible} onclick={handleReloadPromptClicked} />

<h1>{EXTENSION_DISPLAY_NAME}</h1>

{#if !isLoading}
	<h2>Masking Settings</h2>

	<ul class="data-types">
		{#each dataTypes as dataType (dataType.id)}
			<li class="data-type">
				<Switch
					class="data-type-toggle"
					checked={dataTypePreferences[dataType.id] ?? true}
					onchange={() => toggleDataType(dataType)}
				/>
				<span class="data-type-name">{dataType.label}</span>
			</li>
		{/each}
	</ul>

	<h2>Allowed Websites</h2>

	<article class="allowed-website-controls">
		<button class="allowed-website-add-new" onclick={addNewWebsite}>Add new website</button>
		<button class="allowed-website-add-current" onclick={addCurrentWebsite}>Add current</button>
	</article>

	{#if websiteError}
		<p class="website-access-status" role="alert">{websiteError}</p>
	{/if}
	<ul class="allowed-website-patterns">
		{#each [...allowedWebsites, ...draftWebsites] as website (website.id)}
			{@const access = getWebsiteAccess(website.pattern)}
			{@const grants = getWebsiteGrants(website.pattern, origins)}
			<li class="allowed-website-pattern">
				<div class="allowed-website-fields">
					<Switch
						class="allowed-website-pattern-toggle"
						aria-label="Enable masking for this website"
						checked={website.enabled}
						disabled={!website.pattern || savingWebsites[website.id]}
						onchange={(event: Event) =>
							saveWebsite({
								action: 'update',
								id: website.id,
								changes: { enabled: (event.currentTarget as HTMLInputElement).checked }
							})}
					/>
					<input
						class="allowed-website-pattern-input"
						type="text"
						aria-label="Website hostname or URL"
						value={website.pattern}
						readonly={savingWebsites[website.id] || changingAccess}
						onchange={(event) => updateWebsite(website, event.currentTarget)}
						onkeydown={(event) => {
							if (event.key === 'Enter') event.currentTarget.blur();
						}}
						placeholder="Enter hostname or URL"
						use:autofocus={website.pattern === ''}
					/>
					<button
						class="allowed-website-pattern-remove"
						disabled={savingWebsites[website.id] || changingAccess}
						onclick={() => removeWebsite(website.id)}
						aria-label="Remove website pattern"
						title="Remove website pattern"
					>
						<RemoveIcon />
					</button>
				</div>
				{#if grants.length}
					{@const sharedRules = allowedWebsites.filter(
						(rule) => rule.id !== website.id && getWebsiteGrants(rule.pattern, grants).length
					)}
					<div class="website-access-status">
						{#if confirmRevokeId === website.id && sharedRules.length}
							<p>Revoking also affects {sharedRules.map((rule) => rule.pattern).join(', ')}.</p>
							<button onclick={() => revokeWebsiteAccess(grants)}>Revoke access</button>
							<button onclick={() => (confirmRevokeId = undefined)}>Cancel</button>
						{:else}
							<p>Access granted for {grants.join(', ')}</p>
							<button
								disabled={changingAccess || savingWebsites[website.id]}
								onclick={() => {
									if (sharedRules.length) confirmRevokeId = website.id;
									else void revokeWebsiteAccess(grants);
								}}
							>
								Revoke access
							</button>
						{/if}
					</div>
				{:else if access}
					<div class="website-access-status">
						<p>Access needed for {access.request}</p>
						<button
							disabled={changingAccess || savingWebsites[website.id]}
							onclick={() => allowWebsiteAccess(access.request)}
						>
							Allow site access
						</button>
					</div>
				{:else if website.pattern}
					<p class="website-access-status">Enter an HTTP or HTTPS website with a specific host.</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
