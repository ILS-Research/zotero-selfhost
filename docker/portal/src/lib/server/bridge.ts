// Semantic Scholar Bridge (optional service s2-bridge), forwarded under /s2/ so it needs no reverse
// proxy route of its own. The bridge authenticates every request itself, so /s2/ is public here.
import { env } from './config';

export const bridgeURL = () => (env.S2_BRIDGE_URL ?? '').replace(/\/+$/, '');
export const bridgeEnabled = () => bridgeURL() !== '';

const REQUEST_HEADERS = ['authorization', 'zotero-api-key', 'content-type', 'accept'];
const RESPONSE_HEADERS = ['content-type', 'retry-after', 'www-authenticate', 'x-bridge-cache', 'cache-control'];
const MAX_BODY = 1024 * 1024;

/**
 * The client's address: the last X-Forwarded-For entry (added by the reverse proxy in front), else
 * the connection's. The bridge passes it to the dataserver as Zotero-Forwarded-For, so invalid keys
 * block only their sender there, not the bridge.
 */
function clientAddress(request: Request, connection: string): string {
	const forwarded = (request.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
	return forwarded.at(-1) ?? connection;
}

export async function forwardToBridge(request: Request, path: string, search: string, connection: string): Promise<Response> {
	if (!bridgeEnabled()) return new Response(null, { status: 404 });
	const headers = new Headers({ 'x-real-ip': clientAddress(request, connection) });
	for (const h of REQUEST_HEADERS) {
		const v = request.headers.get(h);
		if (v !== null) headers.set(h, v);
	}
	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	const body = hasBody ? new Uint8Array(await request.arrayBuffer()) : undefined;
	if (body && body.byteLength > MAX_BODY) return new Response(null, { status: 413 });
	let response: Response;
	try {
		// Long enough for the bridge's queue timeout and 429 retries
		response = await fetch(`${bridgeURL()}/${path}${search}`, {
			method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(150_000)
		});
	} catch (e) {
		console.error('Semantic Scholar Bridge request failed:', (e as Error).message);
		return Response.json({ error: 'bridge_unreachable', message: 'The Semantic Scholar Bridge could not be reached.' }, { status: 502 });
	}
	const out = new Headers();
	for (const h of RESPONSE_HEADERS) {
		const v = response.headers.get(h);
		if (v !== null) out.set(h, v);
	}
	return new Response(response.body, { status: response.status, headers: out });
}
