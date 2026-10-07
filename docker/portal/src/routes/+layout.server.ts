import { languages } from '$lib/i18n';
import { hasTerms } from '$lib/server/terms';
import type { LayoutServerLoad } from './$types';

// Plain server-rendered forms, no client-side JavaScript (keeps the strict CSP)
export const csr = false;

export const load: LayoutServerLoad = ({ locals, url }) => ({
	language: locals.language,
	languages,
	path: url.pathname,
	hasTerms: hasTerms()
});
