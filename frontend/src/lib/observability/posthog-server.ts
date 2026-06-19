import { PostHog } from 'posthog-node';

type PostHogProperties = Record<string, string | number | boolean | null | undefined>;

function getPostHogKey() {
    return (
        process.env.POSTHOG_API_KEY
        || process.env.NEXT_PUBLIC_POSTHOG_KEY
        || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
    )?.trim();
}

function getPostHogHost() {
    return (
        process.env.POSTHOG_CAPTURE_URL
        || process.env.NEXT_PUBLIC_POSTHOG_HOST
        || 'https://us.i.posthog.com'
    ).trim();
}

function sanitizeProperties(properties: PostHogProperties = {}) {
    return Object.fromEntries(
        Object.entries(properties).filter(([key, value]) => (
            value !== undefined
            && !/email|phone|token|secret|cookie|authorization/i.test(key)
        ))
    );
}

export function isPostHogServerConfigured() {
    return Boolean(getPostHogKey());
}

export function createPostHogServerClient() {
    const key = getPostHogKey();

    if (!key) {
        return null;
    }

    return new PostHog(key, {
        host: getPostHogHost(),
        flushAt: 1,
        flushInterval: 0,
    });
}

export async function capturePostHogServerEvent(
    event: string,
    distinctId: string,
    properties: PostHogProperties = {}
) {
    const client = createPostHogServerClient();

    if (!client) {
        return false;
    }

    try {
        client.capture({
            event,
            distinctId,
            properties: sanitizeProperties(properties),
        });
        await client.shutdown();
        return true;
    } catch {
        await client.shutdown().catch(() => undefined);
        return false;
    }
}
