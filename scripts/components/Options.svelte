<script lang="ts">
	import DeleteIcon from './DeleteIcon.svelte';

	let allowedWebsites: string[] = $state([]);

	function saveOptions(): void {
		chrome.storage.sync.set({ allowedWebsites: [...allowedWebsites] }, () => {
			console.log('Saved allowed websiete patterns!');
		});
	}

	function addWebsite(): void {
		allowedWebsites.push('');
		saveOptions();
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

<h1>Sensitive Data Masker</h1>

<button class="allowed-website-add" onclick={addWebsite}>Add website to mask</button>

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
				aria-label="Remove website"
			>
				<DeleteIcon />
			</button>
		</li>
	{/each}
</ul>
