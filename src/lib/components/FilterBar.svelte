<script>
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import SegmentedTabs from '$lib/components/SegmentedTabs.svelte';

  /** @typedef {import('$lib/types.js').Meta} Meta */

  /**
   * @type {{
   *   meta: Meta,
   *   view: 'digest' | 'simple' | 'board' | 'recent',
   *   total: number,
   *   shown: number
   * }}
   */
  let { meta, view = $bindable(), total, shown } = $props();

  const viewTabs = [
    { value: 'digest', label: 'ダイジェスト' },
    { value: 'simple', label: '一覧' },
    { value: 'board', label: 'ボード' },
    { value: 'recent', label: '動き' }
  ];
</script>

<!-- Plain top nav bar -->
<header
  class="fixed inset-x-0 top-0 z-20 bg-canvas/70 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/60"
>
  <nav
    class="mx-auto flex h-14 max-w-[1100px] items-center gap-2 px-4 sm:gap-5 sm:px-6"
  >
    <!-- Brand -->
    <div class="hidden items-baseline gap-2 sm:flex">
      <span class="text-sm font-bold tracking-tight text-ink">国会ボード</span>
      <span class="rounded-badge bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-deep">
        第{meta.session}回国会
      </span>
    </div>

    <!-- View tabs (Chakra subtle tabs) -->
    <SegmentedTabs
      bind:value={view}
      options={viewTabs}
      variant="plain"
      ariaLabel="表示切り替え"
      class="-ml-2 overflow-x-auto sm:ml-1"
    />

    <div class="ml-auto flex items-center gap-2 sm:gap-3">
      <span class="hidden text-xs text-ink-faint tabular-nums sm:inline">
        {shown} / {total} 件
      </span>
      <ThemeToggle />
    </div>
  </nav>
</header>
