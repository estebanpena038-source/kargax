export async function captureMarketingEvent(
    event: string,
    properties?: Record<string, unknown>
) {
    try {
        const distinctId = typeof window !== 'undefined'
            ? window.localStorage.getItem('kargax-marketing-id') || crypto.randomUUID()
            : crypto.randomUUID();

        if (typeof window !== 'undefined' && !window.localStorage.getItem('kargax-marketing-id')) {
            window.localStorage.setItem('kargax-marketing-id', distinctId);
        }

        await fetch('/api/ops/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event,
                distinctId,
                properties: properties || {},
            }),
        });
    } catch {
        // Best effort tracking only.
    }
}
