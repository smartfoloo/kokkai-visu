<script>
  import { browser } from '$app/environment';
  import { COLUMNS } from '$lib/types';
  import { matchesQuery } from '$lib/search';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import FilterMenu from '$lib/components/FilterMenu.svelte';
  import Column from '$lib/components/Column.svelte';
  import Feed from '$lib/components/Feed.svelte';
  import Digest from '$lib/components/Digest.svelte';
  import ActivityFeed from '$lib/components/ActivityFeed.svelte';
  import StatsHeader from '$lib/components/StatsHeader.svelte';
  import BillDetail from '$lib/components/BillDetail.svelte';

  /** @typedef {import('$lib/types.js').Bill} Bill */
  /** @typedef {import('$lib/types.js').Stage} Stage */

  /** @type {{ data: import('./$types').PageData }} */
  let { data } = $props();
  const bills = $derived(data.bills);
  const meta = $derived(data.meta);

  // --- filters initialised from URL (browser only; SSR prerenders empty) --
  const sp = browser ? new URL(window.location.href).searchParams : new URLSearchParams();
  let filters = $state({
    party: sp.get('party') ?? '',
    category: sp.get('category') ?? '',
    stage: sp.get('stage') ?? '',
    q: sp.get('q') ?? ''
  });
  /** @type {'digest' | 'simple' | 'board' | 'recent'} */
  let view = $state(
    sp.get('view') === 'board'
      ? 'board'
      : sp.get('view') === 'recent'
        ? 'recent'
        : sp.get('view') === 'list'
          ? 'simple'
          : 'digest'
  );
  /** @type {'status' | 'category'} */
  let groupBy = $state(sp.get('group') === 'category' ? 'category' : 'status');

  /** @type {string | null} */
  let selectedId = $state(sp.get('bill'));
  /** @type {DOMRect | null} */
  let originRect = $state(null);
  const selected = $derived(bills.find((b) => b.id === selectedId) ?? null);

  // Parties that actually appear, for the filter dropdown.
  const visibleParties = $derived(
    /** @type {string[]} */ ([...new Set(bills.map((b) => b.submitterParty).filter(Boolean))])
  );

  // --- filtered set ------------------------------------------------------
  const filtered = $derived(
    bills.filter((b) => {
      if (filters.party && b.submitterParty !== filters.party) return false;
      if (filters.category && b.category !== filters.category) return false;
      // The 段階 filter only applies to the board (the feed groups by status instead).
      if (view === 'board' && filters.stage) {
        const inCol =
          filters.stage === '成立'
            ? b.stage === '成立' || b.stage === '廃案'
            : b.stage === filters.stage;
        if (!inCol) return false;
      }
      if (filters.q && !matchesQuery(b, filters.q)) return false;
      return true;
    })
  );

  /**
   * @param {Stage} stage
   * @returns {Bill[]}
   */
  function colBills(stage) {
    if (stage === '成立') return filtered.filter((b) => b.stage === '成立' || b.stage === '廃案');
    return filtered.filter((b) => b.stage === stage);
  }

  /**
   * @param {Bill} b
   * @param {DOMRect} rect
   */
  function select(b, rect) {
    originRect = rect;
    selectedId = b.id;
  }
  function close() {
    selectedId = null;
  }

  /**
   * Follow a digest section's "すべて見る →" (or a theme chip) into the matching view.
   * @param {{ view: 'simple' | 'board' | 'recent', group?: 'status' | 'category', category?: string }} s
   */
  function seeAll(s) {
    view = s.view;
    if (s.group) groupBy = s.group;
    filters.category = s.category ?? '';
    if (browser) window.scrollTo({ top: 0 });
  }

  // --- keep URL in sync (shareable views) --------------------------------
  $effect(() => {
    if (!browser) return;
    const u = new URL(window.location.href);
    const set = (/** @type {string} */ k, /** @type {string} */ v) =>
      v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
    set('party', filters.party);
    set('category', filters.category);
    set('stage', filters.stage);
    set('q', filters.q);
    set('view', view === 'digest' ? '' : view === 'simple' ? 'list' : view);
    set('group', groupBy === 'category' ? 'category' : '');
    set('bill', selectedId ?? '');
    if (u.href !== window.location.href) history.replaceState(history.state, '', u);
  });
</script>

<svelte:head>
  <title>国会ボード</title>
</svelte:head>

<FilterBar {meta} bind:view total={bills.length} shown={filtered.length} />

{#if view === 'digest'}
  <!-- Full-width hero -->
  <div class="pt-[calc(56px+1.5rem)] px-4 sm:px-6 lg:px-8">
    <StatsHeader bills={bills} {meta} />
  </div>

  <!-- Curated digest -->
  <main class="mx-auto max-w-[1100px] px-4 pb-6 mt-10">
    <Digest {bills} {meta} asOf={meta.updatedAt} onselect={select} onseeall={seeAll} />
  </main>
{:else if view === 'simple'}
  <!-- Constrained bills section (no hero — kept to ダイジェスト only) -->
  <main class="mx-auto max-w-[1100px] px-4 pb-6 pt-[calc(56px+1.5rem)]">
    <FilterMenu {meta} bind:filters {view} bind:groupBy {visibleParties} />
    <Feed bills={filtered} {meta} {groupBy} onselect={select} />
  </main>
{:else if view === 'recent'}
  <main class="mx-auto max-w-[1100px] px-4 pb-6 pt-[calc(56px+1.5rem)]">
    <ActivityFeed {bills} {meta} onselect={select} />
  </main>
{:else}
  <main class="mx-auto max-w-[1600px] px-4 pb-4 pt-[calc(56px+1rem)]">
    <FilterMenu {meta} bind:filters {view} bind:groupBy {visibleParties} />
    <div class="flex gap-3 overflow-x-auto pb-4" style="height: calc(100vh - 180px)">
      {#each COLUMNS as col (col.id)}
        <Column
          label={col.label}
          sub={col.sub}
          stage={col.id}
          bills={colBills(col.id)}
          onselect={select}
        />
      {/each}
    </div>
  </main>
{/if}

<BillDetail bill={selected} origin={originRect} onclose={close} />
