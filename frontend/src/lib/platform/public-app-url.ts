export function isLocalAppUrl(url: string) {
    try {
        const parsedUrl = new URL(url);
        return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedUrl.hostname);
    } catch {
        return url.includes('localhost');
    }
}

function normalizeUrl(url: string) {
    return url.replace(/\/$/, '');
}

function getConfiguredEnvUrl() {
    const configuredCandidates = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.APP_URL,
        process.env.SITE_URL,
    ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));

    for (const configuredUrl of configuredCandidates) {
        if (!isLocalAppUrl(configuredUrl)) {
            return normalizeUrl(configuredUrl);
        }
    }

    const vercelHost =
        process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
        || process.env.VERCEL_BRANCH_URL?.trim()
        || process.env.VERCEL_URL?.trim();

    if (vercelHost) {
        return normalizeUrl(`https://${vercelHost.replace(/^https?:\/\//, '')}`);
    }

    return configuredCandidates[0] ? normalizeUrl(configuredCandidates[0]) : null;
}

function getBrowserOrigin() {
    if (typeof window === 'undefined' || !window.location?.origin) {
        return null;
    }

    return normalizeUrl(window.location.origin);
}

export function resolvePublicAppUrl(options?: {
    requestOrigin?: string | null;
    allowLocalhost?: boolean;
}) {
    const allowLocalhost = options?.allowLocalhost ?? false;
    const candidates = [
        getConfiguredEnvUrl(),
        options?.requestOrigin ? normalizeUrl(options.requestOrigin) : null,
        getBrowserOrigin(),
    ].filter((value): value is string => Boolean(value));

    for (const candidate of candidates) {
        if (allowLocalhost || !isLocalAppUrl(candidate)) {
            return candidate;
        }
    }

    return allowLocalhost ? normalizeUrl(process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000') : null;
}

export function shouldAllowLocalPublicAppUrl() {
    return process.env.NEXT_PUBLIC_ALLOW_LOCAL_AUTH_EMAILS === 'true'
        || process.env.ALLOW_LOCAL_AUTH_EMAILS === 'true';
}

export function buildPublicAppUrl(
    path: string,
    options?: {
        requestOrigin?: string | null;
        allowLocalhost?: boolean;
    }
) {
    const baseUrl = resolvePublicAppUrl(options);
    if (!baseUrl) {
        return null;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
}
