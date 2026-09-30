// API keys of logged-in users, for other programs (e.g. the Semantic Scholar Bridge, which checks
// with a key that its owner is in the shared group). Everything goes through the dataserver's
// super-user API; the checks that a key belongs to the acting user happen here. The web-library's
// own key is not listed and cannot be deleted here.
import { api } from './api';
import { FULL_ACCESS } from './accounts';
import { row } from './db';

export type Kind = 'bridge' | 'read' | 'write';
export const KINDS: Kind[] = ['bridge', 'read', 'write'];
export type Key = { key: string; name: string; access: string; dateAdded: string; lastUsed: string };

/** ID of the shared group every user is in, or null */
export async function sharedGroupID(): Promise<number | null> {
	try {
		const id = (await row(`SELECT value FROM zotero_selfhost.settings WHERE name = 'sharedGroupID'`))?.value;
		return id ? Number(id) : null;
	} catch {
		return null;
	}
}

/**
 * Permissions per kind. "bridge": no library access except reading the shared group, which is what
 * a key needs so that /users/<id>/groups lists that (private) group.
 */
async function accessFor(kind: Kind): Promise<object> {
	if (kind === 'write') return FULL_ACCESS;
	if (kind === 'read') return { user: { library: true, files: true, notes: true }, groups: { all: { library: true } } };
	const group = await sharedGroupID();
	return group ? { groups: { [group]: { library: true } } } : {};
}

async function webLibraryKey(userID: number): Promise<string | null> {
	return (await row(`SELECT metaValue FROM zotero_www.users_meta WHERE userID = ? AND metaKey = 'webLibraryKey'`, [userID]))?.metaValue ?? null;
}

/** Short description of a key's permissions: "bridge", "read", "write" or "other" */
function describe(access: any, shared: number | null): string {
	const user = access?.user ?? {};
	const groups = access?.groups ?? {};
	const anyWrite = user.write || Object.values(groups).some((g: any) => g?.write);
	if (anyWrite) return 'write';
	if (user.library) return 'read';
	const ids = Object.keys(groups);
	if (!user.library && (ids.length === 0 || (ids.length === 1 && shared !== null && ids[0] === String(shared)))) return 'bridge';
	return 'other';
}

export async function list(userID: number): Promise<Key[]> {
	const [status, json] = await api('GET', `users/${userID}/keys`, null, true);
	if (status !== 200) throw new Error(`Listing keys failed: ${status}`);
	const hidden = await webLibraryKey(userID);
	const shared = await sharedGroupID();
	return (Array.isArray(json) ? json : [])
		.filter((k: any) => k.key !== hidden)
		.map((k: any) => ({
			key: String(k.key), name: String(k.name ?? ''), access: describe(k.access, shared),
			dateAdded: String(k.dateAdded ?? ''), lastUsed: String(k.lastUsed ?? '')
		}))
		.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
}

/** Creates a key and returns it; the full key is shown once */
export async function create(userID: number, name: string, kind: Kind): Promise<string> {
	const [status, json] = await api('POST', `users/${userID}/keys`, { name, access: await accessFor(kind) }, true);
	if (status !== 201 || !json?.key) throw new Error(`Creating key failed: ${status}`);
	return json.key;
}

/** Deletes one of the user's keys; false if it isn't theirs (or is the web-library's) */
export async function remove(userID: number, key: string): Promise<boolean> {
	if (!/^[A-Za-z0-9]{10,64}$/.test(key) || key === (await webLibraryKey(userID))) return false;
	if (!(await list(userID)).some((k) => k.key === key)) return false;
	const [status] = await api('DELETE', `keys/${key}`, null, true);
	if (status !== 204) throw new Error(`Deleting key failed: ${status}`);
	return true;
}

/** Last characters of a key, to tell keys apart without showing them */
export const masked = (key: string) => '…' + key.slice(-4);
