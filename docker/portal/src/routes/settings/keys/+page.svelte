<script lang="ts">
	import Page from '$lib/components/Page.svelte';
	import Flash from '$lib/components/Flash.svelte';
	import { translator } from '$lib/i18n';

	let { data } = $props();
	const t = $derived(translator(data.language));
	const accessName = (a: string) =>
		({ bridge: t('Semantic Scholar Bridge'), read: t('Read'), write: t('Read and write') })[a] ?? t('Other');
</script>

<Page title={t('API keys')} wide>
	<Flash flash={data.flash} />
	{#if data.created}
		<p>{t('Copy the key now; it is not shown again:')}</p>
		<p><code class="key">{data.created.key}</code></p>
	{/if}
	<p><a href="/">{t('Back to the library')}</a></p>
	<p>{t('API keys let other programs use your Zotero account, e.g. the Semantic Scholar Bridge for Semantic Zotero or AI assistants. Zotero itself does not need one: it connects when you log in.')}</p>
	{#if data.keys.length}
		<table>
			<tbody>
				<tr><th>{t('Name')}</th><th>{t('Key')}</th><th>{t('Access')}</th><th>{t('Created')}</th><th>{t('Last used')}</th><th></th></tr>
				{#each data.keys as k (k.id + k.dateAdded)}
					<tr>
						<td>{k.name}</td>
						<td><code>{k.masked}</code></td>
						<td>{accessName(k.access)}</td>
						<td>{k.dateAdded.slice(0, 10)}</td>
						<td>{k.lastUsed ? k.lastUsed.slice(0, 10) : '–'}</td>
						<td>
							<form method="post">
								<input type="hidden" name="csrf" value={data.csrf}>
								<input type="hidden" name="action" value="delete">
								<input type="hidden" name="id" value={k.id}>
								<input type="hidden" name="added" value={k.dateAdded}>
								<label><input type="checkbox" name="confirm" value="1" required> {t('sure')}</label>
								<button>{t('Delete')}</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p><small>{t('Keys named after a computer ("Zotero on …") belong to Zotero on that computer. Deleting one stops its sync until you log in there again.')}</small></p>
	{:else}
		<p>{t('You have no API keys yet.')}</p>
	{/if}
	<h2>{t('New key')}</h2>
	<form method="post">
		<input type="hidden" name="csrf" value={data.csrf}>
		<input type="hidden" name="action" value="create">
		<p><label>{t('Name')}<br><input name="name" required maxlength="255" value={t('Semantic Scholar Bridge')}></label></p>
		<fieldset>
			<legend>{t('Access')}</legend>
			<p><label><input type="radio" name="kind" value="bridge" checked>
				<b>{t('Semantic Scholar Bridge')}</b> – {data.hasSharedGroup
					? t('only proves that you belong here (read access to the shared group, nothing else). Enter it in Semantic Zotero under Settings → Semantic Zotero → Bridge → Zotero key.')
					: t('only proves who you are, no access to libraries. Enter it in Semantic Zotero under Settings → Semantic Zotero → Bridge → Zotero key.')}</label></p>
			<p><label><input type="radio" name="kind" value="read"> <b>{t('Read')}</b> – {t('your library and all your groups, read only.')}</label></p>
			<p><label><input type="radio" name="kind" value="write"> <b>{t('Read and write')}</b> – {t('your library and all your groups, including changes. Only for programs you trust.')}</label></p>
		</fieldset>
		<p><button>{t('Create key')}</button></p>
	</form>
</Page>

<style>
	.key { font-size: 1.1rem; user-select: all; word-break: break-all; }
	fieldset { border: 1px solid rgba(127, 127, 127, .4); }
	td label { font-size: .85rem; margin-right: .3rem; }
</style>
