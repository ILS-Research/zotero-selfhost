// Server-side sessions, referenced by a random ID in the zotero_portal cookie. Kept in MySQL
// (zotero_selfhost.portalSessions, created on first use), so logins survive a restart of the portal;
// the table holds a hash of the ID, not the ID itself. Without the database they live in memory only.
import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { config } from './config';
import { exec, row } from './db';

export type SessionUser = { sub?: string; username: string; email?: string; userID?: number };
type Pending = { nonce: string; returnTo: string; time: number };

export type SessionData = {
	user?: SessionUser;
	returnTo?: string;
	/** Pending OIDC logins by state, so several tabs or reloads during login don't clash */
	oidcPending?: Record<string, Pending>;
	idToken?: string;
	signinCsrf?: string;
	/** CSRF token per desktop client login token */
	loginCsrf?: Record<string, string>;
	groupsCsrf?: string;
	groupsFlash?: { error: boolean; text: string };
	keysCsrf?: string;
	keysFlash?: { error: boolean; text: string };
	/** A key just created, shown once */
	keysCreated?: { name: string; key: string };
};

const COOKIE = 'zotero_portal';
const IDLE_MS = 8 * 3600 * 1000;
/** Last use is written back at most this often when nothing else changed */
const TOUCH_MS = 60 * 1000;
const TABLE = 'zotero_selfhost.portalSessions';
const memory = new Map<string, { data: SessionData; seen: number }>();
let lastSweep = Date.now();
let tableReady: Promise<void> | null = null;

export const token = () => randomBytes(16).toString('hex');
const hash = (id: string) => createHash('sha256').update(id).digest('hex');

function ensureTable(): Promise<void> {
	tableReady ??= exec(`CREATE TABLE IF NOT EXISTS ${TABLE} (
		idHash CHAR(64) NOT NULL PRIMARY KEY,
		data MEDIUMTEXT NOT NULL,
		seen BIGINT NOT NULL,
		KEY seen (seen)
	) CHARACTER SET utf8mb4`).then(() => undefined, (e) => { tableReady = null; throw e; });
	return tableReady;
}

/** The database, or null (then memory) if it can't be reached; logged once per failure streak */
let dbDown = false;
async function stored<T>(fn: () => Promise<T>): Promise<T | null> {
	try {
		await ensureTable();
		const result = await fn();
		if (dbDown) console.error('Sessions: database reachable again');
		dbDown = false;
		return result;
	} catch (e) {
		if (!dbDown) console.error('Sessions: database not reachable, keeping sessions in memory:', (e as Error).message);
		dbDown = true;
		return null;
	}
}

export class Session {
	id = '';
	data: SessionData = {};
	private loaded = '';
	private seen = 0;
	private inDB = false;

	private constructor(private cookies: Cookies) {}

	/** The session of the request's cookie, or a new one */
	static async load(cookies: Cookies): Promise<Session> {
		const s = new Session(cookies);
		const now = Date.now();
		if (now - lastSweep > 600_000) {
			lastSweep = now;
			for (const [id, m] of memory) if (now - m.seen > IDLE_MS) memory.delete(id);
			await stored(() => exec(`DELETE FROM ${TABLE} WHERE seen < ?`, [now - IDLE_MS]));
		}
		const id = cookies.get(COOKIE) ?? '';
		if (id) {
			const r = await stored(() => row<{ data: string; seen: number }>(`SELECT data, seen FROM ${TABLE} WHERE idHash = ?`, [hash(id)]));
			const m = memory.get(id);
			if (r && now - Number(r.seen) <= IDLE_MS) {
				s.id = id;
				s.data = JSON.parse(r.data);
				s.loaded = r.data;
				s.seen = Number(r.seen);
				s.inDB = true;
				return s;
			}
			if (m && now - m.seen <= IDLE_MS) {
				m.seen = now;
				s.id = id;
				s.data = m.data;
				return s;
			}
		}
		s.start();
		return s;
	}

	private start() {
		this.id = randomBytes(24).toString('base64url');
		this.loaded = '';
		this.seen = 0;
		this.inDB = false;
		memory.set(this.id, { data: this.data, seen: Date.now() });
		this.cookies.set(COOKIE, this.id, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secureCookies });
	}

	/** Writes the session back if it changed (or its last use is old); called once per request */
	async save(): Promise<void> {
		if (!this.id) return;
		const json = JSON.stringify(this.data);
		const now = Date.now();
		// Empty new sessions (e.g. a plugin update check) are not stored
		if (!this.inDB && json === '{}') return;
		if (json === this.loaded && now - this.seen < TOUCH_MS) return;
		const ok = await stored(() => exec(`REPLACE INTO ${TABLE} (idHash, data, seen) VALUES (?, ?, ?)`, [hash(this.id), json, now]));
		if (ok !== null) {
			memory.delete(this.id);
			this.loaded = json;
			this.seen = now;
			this.inDB = true;
		}
	}

	/** New ID for the same data, after a login (prevents session fixation) */
	regenerate() {
		this.forget();
		this.start();
	}

	destroy() {
		this.forget();
		this.data = {};
		this.id = '';
		this.cookies.delete(COOKIE, { path: '/', secure: config.secureCookies });
	}

	private forget() {
		memory.delete(this.id);
		if (this.inDB) {
			const old = hash(this.id);
			void stored(() => exec(`DELETE FROM ${TABLE} WHERE idHash = ?`, [old]));
		}
	}
}
