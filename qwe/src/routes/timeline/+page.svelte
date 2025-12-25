<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { pb, listRecords, createRecord } from "$lib/pocketbase";
    import type { RecordModel } from "pocketbase";

    let tweets = $state<RecordModel[]>([]);
    let newTweetContent = $state("");
    let isSubmitting = $state(false);
    let error = $state("");

    async function fetchTweets() {
        try {
            const result = await listRecords("tweets", 1, 50, "", "-created");
            tweets = result.items;
        } catch (e) {
            console.error("Failed to fetch tweets:", e);
        }
    }

    async function postTweet() {
        if (!newTweetContent.trim() || isSubmitting) return;

        isSubmitting = true;
        error = "";
        try {
            await createRecord("tweets", {
                content: newTweetContent,
            });
            newTweetContent = "";
        } catch (e) {
            error =
                'Failed to post tweet. Make sure the "tweets" collection exists and is public.';
            console.error(e);
        } finally {
            isSubmitting = false;
        }
    }

    onMount(() => {
        fetchTweets();

        // Realtime subscription
        pb.collection("tweets").subscribe("*", (e) => {
            if (e.action === "create") {
                tweets = [e.record, ...tweets];
            } else if (e.action === "delete") {
                tweets = tweets.filter((t) => t.id !== e.record.id);
            } else if (e.action === "update") {
                tweets = tweets.map((t) =>
                    t.id === e.record.id ? e.record : t,
                );
            }
        });
    });

    onDestroy(() => {
        pb.collection("tweets").unsubscribe("*");
    });

    function formatTime(dateStr: string) {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function formatDate(dateStr: string) {
        const date = new Date(dateStr);
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
</script>

<svelte:head>
    <title>Timeline - FStack</title>
</svelte:head>

<main>
    <div class="container">
        <!-- Post Box -->
        <div class="post-card">
            <textarea
                placeholder="What's happening?"
                bind:value={newTweetContent}
                disabled={isSubmitting}
            ></textarea>
            {#if error}
                <p class="error-msg">{error}</p>
            {/if}
            <div class="post-actions">
                <button
                    class="post-btn"
                    onclick={postTweet}
                    disabled={!newTweetContent.trim() || isSubmitting}
                >
                    {#if isSubmitting}
                        Posting...
                    {:else}
                        Post Tweet
                    {/if}
                </button>
            </div>
        </div>

        <!-- Feed -->
        <div class="feed">
            {#if tweets.length === 0}
                <div class="empty-state">
                    <p>No tweets yet. Be the first to share something!</p>
                </div>
            {:else}
                {#each tweets as tweet (tweet.id)}
                    <div class="tweet-card">
                        <div class="tweet-avatar">
                            {tweet.id.substring(0, 2).toUpperCase()}
                        </div>
                        <div class="tweet-content">
                            <div class="tweet-header">
                                <span class="user-handle">Anonymous</span>
                                <span class="dot">·</span>
                                <span class="timestamp"
                                    >{formatDate(tweet.created)}
                                    {formatTime(tweet.created)}</span
                                >
                            </div>
                            <p class="tweet-text">{tweet.content}</p>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>

        <footer>
            <p>Built with SvelteKit + PocketBase</p>
        </footer>
    </div>
</main>

<style>
    main {
        padding: 2rem 0;
    }

    .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 0 1rem;
    }

    /* Post Card */
    .post-card {
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 12px;
        padding: 1.25rem;
        margin-bottom: 2rem;
    }

    textarea {
        width: 100%;
        background: transparent;
        border: none;
        color: #fafafa;
        font-family: inherit;
        font-size: 1.125rem;
        resize: none;
        min-height: 100px;
        margin-bottom: 1rem;
        outline: none;
    }

    textarea::placeholder {
        color: #52525b;
    }

    .error-msg {
        color: #ef4444;
        font-size: 0.875rem;
        margin-bottom: 1rem;
    }

    .post-actions {
        display: flex;
        justify-content: flex-end;
        border-top: 1px solid #27272a;
        padding-top: 1rem;
    }

    .post-btn {
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 9999px;
        padding: 0.5rem 1.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .post-btn:hover:not(:disabled) {
        background: #2563eb;
    }

    .post-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Feed */
    .feed {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background: #27272a;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #27272a;
    }

    .tweet-card {
        background: #18181b;
        padding: 1.25rem;
        display: flex;
        gap: 1rem;
        transition: background 0.1s;
    }

    .tweet-card:hover {
        background: #1c1c20;
    }

    .tweet-avatar {
        width: 40px;
        height: 40px;
        background: #27272a;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        color: #a1a1aa;
        flex-shrink: 0;
    }

    .tweet-content {
        flex: 1;
    }

    .tweet-header {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        margin-bottom: 0.25rem;
    }

    .user-handle {
        font-weight: 600;
        font-size: 0.875rem;
    }

    .timestamp,
    .dot {
        color: #52525b;
        font-size: 0.875rem;
    }

    .tweet-text {
        color: #e4e4e7;
        font-size: 1rem;
        white-space: pre-wrap;
    }

    .empty-state {
        background: #18181b;
        padding: 3rem;
        text-align: center;
        color: #71717a;
    }

    footer {
        margin-top: 3rem;
        text-align: center;
        padding-bottom: 2rem;
    }

    footer p {
        font-size: 0.75rem;
        color: #3f3f46;
    }
</style>
