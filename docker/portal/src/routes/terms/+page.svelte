<script lang="ts">
	import Page from '$lib/components/Page.svelte';
	import { translator } from '$lib/i18n';

	let { data } = $props();
	const t = $derived(translator(data.language));
</script>

<Page title={t('Terms of use')} wide>
	<!-- Written by the admin of this server -->
	{@html data.html}
</Page>
