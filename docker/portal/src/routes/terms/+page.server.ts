// Terms of use (data/terms, see lib/server/terms). Public: they are read before logging in, and the desktop client
// links here without a session.
import { error } from '@sveltejs/kit';
import { termsPage } from '$lib/server/terms';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const html = termsPage(locals.language);
	if (html === null) {
		error(404, { title: locals.t('Not found'), message: locals.t('No terms of use have been published on this server.') });
	}
	return { html };
};
