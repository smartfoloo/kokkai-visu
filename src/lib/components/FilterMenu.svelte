<script>
  import { COLUMNS } from '$lib/types';
  import Dropdown from './Dropdown.svelte';
  import SegmentedTabs from './SegmentedTabs.svelte';
  import CategoryChips from './CategoryChips.svelte';

  /** @typedef {import('$lib/types.js').Meta} Meta */
  /** @typedef {{ value: string, label: string, color?: string }} Option */
  /**
   * @typedef {object} Filters
   * @property {string} party
   * @property {string} category
   * @property {string} stage '' or a Stage id
   * @property {string} q
   */

  /**
   * @type {{
   *   meta: Meta,
   *   filters: Filters,
   *   view: 'simple' | 'board' | 'recent',
   *   groupBy: 'status' | 'category',
   *   visibleParties: string[]
   * }}
   */
  let { meta, filters = $bindable(), view, groupBy = $bindable(), visibleParties } = $props();

  /** @type {Option[]} */
  const partyOptions = $derived(
    meta.parties
      .filter((p) => visibleParties.includes(p.key) && p.key !== 'cabinet')
      .map((p) => ({ value: p.key, label: p.label, color: p.color }))
  );
  /** @type {Option[]} */
  const categoryOptions = $derived(meta.categories.map((c) => ({ value: c, label: c })));
  /** @type {Option[]} */
  const stageOptions = $derived(COLUMNS.map((c) => ({ value: c.id, label: c.label })));

  function clear() {
    filters.party = '';
    filters.category = '';
    filters.stage = '';
    filters.q = '';
  }

  const dirty = $derived(!!(filters.party || filters.category || filters.stage || filters.q));
</script>

<div class="mb-8 space-y-3">
<div class="flex flex-wrap items-center gap-2">
  <!-- Search -->
  <div class="relative">
    <svg
      class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5" />
      <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <input
      type="search"
      bind:value={filters.q}
      placeholder="法案名で検索…"
      class="h-9 w-44 rounded-control border border-line bg-surface pl-8 pr-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
  </div>

  <!-- On the 一覧 view, themes are chosen via the chip row below (more discoverable). -->
  {#if view !== 'simple'}
    <Dropdown
      bind:value={filters.category}
      options={categoryOptions}
      placeholder="すべてのテーマ"
      label="テーマ"
    />
  {/if}
  <Dropdown
    bind:value={filters.party}
    options={partyOptions}
    placeholder="すべての政党"
    label="政党"
  />
  {#if view === 'board'}
    <Dropdown
      bind:value={filters.stage}
      options={stageOptions}
      placeholder="すべての段階"
      label="段階"
    />
  {/if}

  {#if view === 'simple'}
    <div class="flex items-center gap-1.5 text-xs text-ink-faint">
      <span class="hidden sm:inline">まとめ方</span>
      <SegmentedTabs
        bind:value={groupBy}
        options={[
          { value: 'status', label: '状況' },
          { value: 'category', label: 'テーマ' }
        ]}
        variant="plain"
        ariaLabel="まとめ方"
      />
    </div>
  {/if}

  {#if dirty}
    <button
      type="button"
      onclick={clear}
      class="pill ml-auto hover:border-accent/30 hover:text-accent-deep"
    >
      クリア ✕
    </button>
  {/if}
</div>

  {#if view === 'simple'}
    <CategoryChips bind:value={filters.category} categories={meta.categories} />
  {/if}
</div>
