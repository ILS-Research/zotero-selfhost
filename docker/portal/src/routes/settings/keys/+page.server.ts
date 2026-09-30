// API keys for other programs: list, create (the full key is shown once), delete. Every change is
// a POST that redirects back with a message, so reloading the page doesn't repeat it.
import { error, redirect } from '@sveltejs/kit';
import * as keys from '$lib/server/keys';
import { config } from '$lib/server/config';
import { token } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

const HERE = '/settings/keys';

export const load: PageServerLoad = async ({ locals }) => {
	const s = locals.session.data;
	s.keysCsrf ??= token();
	const flash = s.keysFlash ?? null;
	const created = s.keysCreated ?? null;
	delete s.keysFlash;
	delete s.keysCreated;
	return {
		csrf: s.keysCsrf,
		flash,
		created,
		hasSharedGroup: (await keys.sharedGroupID()) !== null,
		keys: (await keys.list(locals.user!.userID)).map((k) => ({ ...k, key: undefined, id: k.key.slice(-4), masked: keys.masked(k.key) }))
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const t = locals.t;
		const s = locals.session.data;
		const form = await request.formData();
		if (!s.keysCsrf || form.get('csrf') !== s.keysCsrf) {
			error(403, { title: t('Request rejected'), message: t('The form was invalid.'), link: { href: HERE, label: t('Try again') } });
		}
		const me = locals.user!.userID;
		const action = String(form.get('action') ?? '');
		try {
			if (action === 'create') {
				const kind = String(form.get('kind') ?? '') as keys.Kind;
				const name = String(form.get('name') ?? '').trim();
				if (!keys.KINDS.includes(kind)) s.keysFlash = { error: true, text: t('The form was invalid.') };
				else if (name === '' || name.length > 255) s.keysFlash = { error: true, text: t('Please enter a name (at most 255 characters).') };
				else {
					s.keysCreated = { name, key: await keys.create(me, name, kind) };
					s.keysFlash = { error: false, text: t('The key %s was created.', name) };
				}
			} else if (action === 'delete') {
				// The form names the key by its last characters; find the full key among the user's own
				const id = String(form.get('id') ?? '');
				const key = (await keys.list(me)).find((k) => k.key.slice(-4) === id && k.dateAdded === String(form.get('added') ?? ''));
				s.keysFlash = key && form.get('confirm') === '1' && (await keys.remove(me, key.key))
					? { error: false, text: t('The key %s was deleted.', key.name) }
					: { error: true, text: t('You are not allowed to do that.') };
			} else {
				s.keysFlash = { error: true, text: t('The form was invalid.') };
			}
		} catch (e) {
			console.error(e);
			s.keysFlash = { error: true, text: t('The change could not be saved.') };
		}
		redirect(303, config.baseURL + HERE);
	}
};
