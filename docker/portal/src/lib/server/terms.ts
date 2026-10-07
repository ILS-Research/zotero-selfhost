// Terms of use of this server, published by its admin: data/terms/terms.<language>.html or terms.html, an HTML
// fragment like the downloads page. Shown at /terms (public) and linked on every portal page and in the
// web-library menu once a file exists. The desktop client's "terms and conditions" link (Settings → Sync) reaches
// it through the companion plugin Zotero Custom Cloud Modifier.
import fs from 'node:fs';
import path from 'node:path';

export const TERMS_DIR = '/var/www/terms';

/** The terms in the language, else the language-neutral or English ones, else those in any language, else null */
export function termsPage(language: string): string | null {
	let others: string[] = [];
	try {
		others = fs.readdirSync(TERMS_DIR).filter((f) => /^terms\.[a-z]{2}\.html$/.test(f)).sort();
	} catch {
		// no directory
	}
	for (const name of [`terms.${language}.html`, 'terms.html', 'terms.en.html', ...others]) {
		const file = path.join(TERMS_DIR, name);
		try {
			if (fs.statSync(file).isFile()) return fs.readFileSync(file, 'utf8');
		} catch {
			// not there
		}
	}
	return null;
}

export function hasTerms(): boolean {
	try {
		return fs.readdirSync(TERMS_DIR).some((f) => /^terms(\.[a-z]{2})?\.html$/.test(f));
	} catch {
		return false;
	}
}
