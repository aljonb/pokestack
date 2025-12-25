<script lang="ts">
	import { onMount } from "svelte";
	import {
		pb,
		logout,
		isAuthenticated,
		getCurrentUser,
	} from "$lib/pocketbase";
	import favicon from "$lib/assets/favicon.svg";
	import "../app.css"; // We'll create this

	let { children } = $props();

	// Reactive auth state
	let user = $state(getCurrentUser());
	let isAuth = $state(isAuthenticated());

	onMount(() => {
		// Sync auth state whenever it changes
		pb.authStore.onChange(() => {
			user = getCurrentUser();
			isAuth = isAuthenticated();
		});
	});

	function handleLogout() {
		logout();
		window.location.href = "/";
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link
		rel="preconnect"
		href="https://fonts.gstatic.com"
		crossorigin="anonymous"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Geist:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="app-layout">
	<nav class="global-nav">
		<div class="nav-container">
			<a href="/" class="nav-brand">
				<span class="logo">⚡</span>
				<span class="brand-name">FStack</span>
			</a>
			<div class="nav-links">
				<a href="/timeline">Timeline</a>
				<div class="divider"></div>
				{#if isAuth}
					<div class="user-info">
						<span class="user-email">{user?.email}</span>
						<button class="logout-btn" onclick={handleLogout}
							>Logout</button
						>
					</div>
				{:else}
					<a href="/login" class="login-link">Login</a>
				{/if}
			</div>
		</div>
	</nav>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.global-nav {
		background: #09090b;
		border-bottom: 1px solid #27272a;
		padding: 0.75rem 0;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 0 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.nav-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: #fafafa;
	}

	.logo {
		width: 32px;
		height: 32px;
		background: linear-gradient(135deg, #22c55e 0%, #10b981 100%);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
	}

	.brand-name {
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.nav-links a {
		text-decoration: none;
		color: #a1a1aa;
		font-size: 0.875rem;
		font-weight: 500;
		transition: color 0.2s;
	}

	.nav-links a:hover {
		color: #fafafa;
	}

	.divider {
		width: 1px;
		height: 16px;
		background: #27272a;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.user-email {
		font-size: 0.8125rem;
		color: #71717a;
	}

	.logout-btn {
		background: #27272a;
		color: #fafafa;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.logout-btn:hover {
		background: #3f3f46;
	}

	.login-link {
		background: #fafafa;
		color: #18181b !important;
		padding: 0.4rem 1rem;
		border-radius: 6px;
		font-weight: 600 !important;
	}

	.login-link:hover {
		background: #f4f4f5 !important;
	}

	main {
		flex: 1;
	}
</style>
