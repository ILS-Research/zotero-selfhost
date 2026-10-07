// Links the Zotero desktop app makes for zotero.org, as this portal understands them. The app builds them from
// http(s)://(www.)zotero.org/… ("New Group…", group and library links, "View Online"); the ILS plugin
// "GuM-Anbindung" sends them here with the same path. Paths of the web-library itself are left alone.
import * as groups from './groups';

const KEY = '[A-Z0-9]{8}';

/** Where a zotero.org-style path goes here, or null when it is not one (then the web-library handles it). */
export async function zoteroOrgTarget(path: string, user: { userID: number; username: string }): Promise<string | null> {
	const p = path.replace(/\/+$/, '') || '/';
	if (p === '/groups/new') return '/settings/groups#new';
	if (p === '/groups') return '/settings/groups';
	let m = new RegExp(`^/groups/(\\d+)(?:/items/(${KEY}))?$`).exec(p);
	if (m) {
		const group = await groups.get(Number(m[1]), user.userID);
		if (!group) return '/settings/groups';
		const library = groups.libraryURL(group);
		return m[2] ? library.replace(/\/library$/, `/items/${m[2]}`) : library;
	}
	m = new RegExp(`^/users/(\\d+)(?:/items/(${KEY}))?$`).exec(p);
	if (m) {
		// The web-library shows only the logged-in user's own library.
		if (Number(m[1]) !== user.userID) return '/';
		return m[2] ? `/${user.username}/items/${m[2]}` : `/${user.username}/library`;
	}
	return null;
}
