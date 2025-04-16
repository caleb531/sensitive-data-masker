<script lang="ts">
	import { EXTENSION_DISPLAY_NAME } from '../config';
	import RemoveIcon from './RemoveIcon.svelte';

	let allowedWebsites: string[] = $state([]);

	function saveOptions(): void {
		chrome.storage.sync.set({ allowedWebsites: [...allowedWebsites] }, () => {
			console.log('Saved allowed websiete patterns!');
		});
	}

	function addWebsite(website: string): void {
		allowedWebsites.push(website);
		saveOptions();
	}

	async function addNewWebsite() {
		addWebsite('');
	}

	async function addCurrentWebsite() {
		const activeTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
		if (activeTab.url) {
			addWebsite(new URL(activeTab.url).host || '');
		}
	}

	function removeWebsite(index: number): void {
		allowedWebsites = allowedWebsites.filter((_, i) => i !== index);
		saveOptions();
	}

	function updateWebsite(index: number, value: string): void {
		allowedWebsites[index] = value;
		saveOptions();
	}

	// Initially loaded websites list from Chrome storage
	$effect(() => {
		chrome.storage.sync.get('allowedWebsites', (result) => {
			if (result.allowedWebsites) {
				allowedWebsites = result.allowedWebsites;
			}
		});
	});
</script>

<h1>{EXTENSION_DISPLAY_NAME}</h1>

<button class="allowed-website-add-new" onclick={addNewWebsite}>Add website to mask</button>
<button class="allowed-website-add-current" onclick={addCurrentWebsite}>Add current</button>

<ul class="allowed-website-patterns">
	{#each allowedWebsites as _, index}
		<li class="allowed-website-pattern">
			<input
				class="allowed-website-pattern-input"
				type="text"
				bind:value={allowedWebsites[index]}
				oninput={(e) => updateWebsite(index, (e.target as HTMLInputElement).value)}
				placeholder="Enter hostname or URL"
			/>
			<button
				class="allowed-website-pattern-remove"
				onclick={() => removeWebsite(index)}
				aria-label="Remove website pattern"
				title="Remove website pattern"
			>
				<RemoveIcon />
			</button>
		</li>
	{/each}
</ul>
