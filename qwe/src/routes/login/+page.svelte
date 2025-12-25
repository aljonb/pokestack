<script lang="ts">
    import { loginWithGoogle, isAuthenticated } from "$lib/pocketbase";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";

    let error = $state("");
    let isLoading = $state(false);

    async function handleGoogleLogin() {
        isLoading = true;
        error = "";
        try {
            await loginWithGoogle();
            // Redirection is handled by authStore update in layout, but let's be explicit
            goto("/");
        } catch (e: any) {
            console.error("Login failed:", e);
            error =
                e.message ||
                "Failed to authenticate with Google. Make sure Google OAuth2 is configured in PocketBase Settings.";
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        if (isAuthenticated()) {
            goto("/");
        }
    });
</script>

<svelte:head>
    <title>Login - FStack</title>
</svelte:head>

<main>
    <div class="login-container">
        <div class="login-card">
            <div class="brand-header">
                <div class="logo">⚡</div>
                <h1>Welcome back</h1>
                <p>Sign in to your account</p>
            </div>

            <div class="auth-methods">
                <button
                    class="google-btn"
                    onclick={handleGoogleLogin}
                    disabled={isLoading}
                >
                    {#if isLoading}
                        <span class="spinner"></span>
                        Connecting...
                    {:else}
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Continue with Google
                    {/if}
                </button>
            </div>

            {#if error}
                <div class="error-box">
                    {error}
                </div>
            {/if}

            <div class="footer-links">
                <a href="/">← Go back</a>
            </div>
        </div>
    </div>
</main>

<style>
    :global(body) {
        background: #09090b;
        color: #fafafa;
        font-family: "Geist", sans-serif;
    }

    .login-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
    }

    .login-card {
        width: 100%;
        max-width: 400px;
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 16px;
        padding: 2.5rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    .brand-header {
        text-align: center;
        margin-bottom: 2.5rem;
    }

    .logo {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #22c55e 0%, #10b981 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        margin: 0 auto 1.25rem;
    }

    h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #fafafa;
        margin-bottom: 0.5rem;
    }

    p {
        color: #71717a;
        font-size: 0.875rem;
    }

    .auth-methods {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .google-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.75rem;
        background: #fafafa;
        color: #18181b;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.9375rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .google-btn:hover:not(:disabled) {
        background: #f4f4f5;
        transform: translateY(-1px);
    }

    .google-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .error-box {
        margin-top: 1.5rem;
        padding: 0.75rem;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 8px;
        color: #ef4444;
        font-size: 0.8125rem;
        text-align: center;
        border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .footer-links {
        margin-top: 2rem;
        text-align: center;
    }

    .footer-links a {
        color: #71717a;
        text-decoration: none;
        font-size: 0.8125rem;
        transition: color 0.2s;
    }

    .footer-links a:hover {
        color: #fafafa;
    }

    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(0, 0, 0, 0.1);
        border-top-color: #000;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
