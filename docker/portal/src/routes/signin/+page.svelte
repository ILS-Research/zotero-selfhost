<script lang="ts">
	import Page from '$lib/components/Page.svelte';
	import { translator } from '$lib/i18n';

	let { data, form } = $props();
	const t = $derived(translator(data.language));
</script>

<Page title={t('Log in')}>
	{#if data.oidcLabel}
		<!-- A link, not a form: /oidc/start redirects to the provider, and Chrome/Edge apply the CSP's
		     form-action 'self' to redirects after a form submission (Firefox only to the first target). -->
		<p><a class="button" href="/oidc/start">{t('Log in with %s', data.oidcLabel)}</a></p>
		<hr>
		<p>{t('Or with username and password:')}</p>
	{/if}
	{#if form?.wrongPassword}<p><b>{t('Wrong username or password.')}</b></p>{/if}
	<form method="post">
		<input type="hidden" name="csrf" value={data.csrf}>
		<!-- svelte-ignore a11y_autofocus -->
		<p><label>{t('Username or email')}<br><input name="username" autocomplete="username" required autofocus></label></p>
		<p><label>{t('Password')}<br><input name="password" type="password" autocomplete="current-password" required></label></p>
		<p><button>{t('Log in')}</button></p>
	</form>
	{#if data.hasDownloads}
		<hr>
		<p><a href="/downloads">{t('Downloads: Zotero plugins and setup')}</a></p>
	{/if}
</Page>
