import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler'
			}
		}
	},
	// Build the masking script so the service worker can register it at runtime
	plugins: [svelte(), webExtension({ additionalInputs: ['content-script.ts'] })]
});
