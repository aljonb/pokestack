import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Exclude PocketBase data and binary directories from file watching
		watch: {
			ignored: ['**/bin/**', '**/pb_data/**']
		}
	}
});
