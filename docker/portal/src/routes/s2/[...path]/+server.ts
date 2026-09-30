// Semantic Scholar Bridge under /s2/ (see $lib/server/bridge). /s2 redirects to /s2/, so the status
// page's relative links resolve below /s2/.
import { redirect } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { bridgeEnabled, forwardToBridge } from '$lib/server/bridge';
import type { RequestHandler } from './$types';

// Keep /s2/ as it is; Kit would strip the slash
export const trailingSlash = 'ignore';

export const fallback: RequestHandler = ({ request, params, url, getClientAddress }) => {
	if (url.pathname === '/s2' && bridgeEnabled()) redirect(308, config.baseURL + '/s2/');
	return forwardToBridge(request, params.path, url.search, getClientAddress());
};
