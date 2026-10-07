// Every other path is the web-library (it routes in the browser), configured for this user
import { config, env } from '$lib/server/config';
import { getWebLibraryKey } from '$lib/server/accounts';
import { hasDownloads } from '$lib/server/downloads';
import { hasTerms } from '$lib/server/terms';
import template from '$lib/server/web-library.html?raw';
import { zoteroOrgTarget } from '$lib/server/zoteroLinks';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// JSON that is safe inside <script>
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/&/g, '\\u0026');

export const GET: RequestHandler = async ({ locals, url }) => {
	const { t } = locals;
	const user = locals.user!;
	// Links the desktop app makes for zotero.org ("New Group…", "View Online"), see zoteroLinks.ts
	const target = await zoteroOrgTarget(url.pathname, user);
	if (target) redirect(302, target);
	const webConfig = {
		userId: String(user.userID),
		userSlug: user.username,
		apiKey: await getWebLibraryKey(user.userID),
		apiConfig: { apiScheme: env.API_SCHEME, apiAuthorityPart: env.API_AUTHORITY, retry: 2 },
		websiteUrl: `${config.baseURL}/`,
		streamingApiUrl: env.STREAMING_URL,
		translateUrl: `${config.baseURL}/translate`,
		libraries: { includeMyLibrary: true, includeUserGroups: true }
	};
	const downloads = hasDownloads() ? [{ label: t('Downloads'), href: '/downloads' }] : [];
	const terms = hasTerms() ? [{ label: t('Terms of use'), href: '/terms' }] : [];
	const menu = {
		desktop: [
			{ label: 'My Library', href: '/', active: true },
			{ label: t('Groups'), href: '/settings/groups' },
			...downloads,
			{ label: user.username, dropdown: true, truncate: true, entries: [{ label: t('API keys'), href: '/settings/keys' }, ...terms, { label: t('Log out'), href: '/logout' }] }
		],
		mobile: [
			{ label: 'My Library', href: '/', active: true },
			{ label: t('Groups'), href: '/settings/groups' },
			...downloads,
			{ label: t('API keys'), href: '/settings/keys' },
			...terms,
			{ label: t('Log out'), href: '/logout' }
		]
	};
	const html = template.replace('{{CONFIG}}', () => json(webConfig)).replace('{{MENU}}', () => json(menu));
	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
};
