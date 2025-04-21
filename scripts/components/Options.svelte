<script lang="ts">
	import { EXTENSION_DISPLAY_NAME } from '../config';
	import type { AllowedWebsite } from '../types';
	import RemoveIcon from './RemoveIcon.svelte';
	import Switch from './Switch.svelte';

	const allowedWebsites: AllowedWebsite[] = $state([]);

	function saveOptions(): void {
		chrome.storage.sync.set(
			{ allowedWebsites: allowedWebsites.filter((website) => website.pattern?.trim()) },
			() => {
				console.log('Saved allowed website patterns!');
			}
		);
	}

	function addWebsite(website: string): void {
		allowedWebsites.push({ pattern: website, enabled: true });
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
		allowedWebsites.splice(index, 1);
		saveOptions();
	}

	function updateWebsite(index: number, value: string): void {
		allowedWebsites[index].pattern = value;
		saveOptions();
	}

	function toggleWebsiteEnabled(index: number): void {
		allowedWebsites[index].enabled = !allowedWebsites[index].enabled;
		saveOptions();
	}

	// Autofocus new input when added
	function autofocus(node: HTMLElement, condition: boolean) {
		if (condition) {
			node.focus();
		}
	}

	// Initially loaded websites list from Chrome storage
	$effect(() => {
		chrome.storage.sync.get('allowedWebsites', (result) => {
			if (result.allowedWebsites) {
				allowedWebsites.push(...result.allowedWebsites);
			}
		});
	});
</script>

<h1>{EXTENSION_DISPLAY_NAME}</h1>

<article class="allowed-website-controls">
	<button class="allowed-website-add-new" onclick={addNewWebsite}>Add new website</button>
	<button class="allowed-website-add-current" onclick={addCurrentWebsite}>Add current</button>
</article>

<ul class="allowed-website-patterns">
	{#each allowedWebsites as website, index}
		<li class="allowed-website-pattern">
			<Switch
				class="allowed-website-pattern-toggle"
				checked={website.enabled}
				onchange={() => toggleWebsiteEnabled(index)}
			/>
			<input
				class="allowed-website-pattern-input"
				type="text"
				bind:value={website.pattern}
				oninput={(e) => updateWebsite(index, (e.target as HTMLInputElement).value)}
				placeholder="Enter hostname or URL"
				use:autofocus={website.pattern === ''}
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
