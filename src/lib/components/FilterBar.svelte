<script>
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import TranslateMenu from '$lib/components/TranslateMenu.svelte';

  /** @typedef {import('$lib/types.js').Meta} Meta */

  /**
   * @type {{
   *   meta: Meta,
   *   view: 'simple' | 'board' | 'recent',
   *   total: number,
   *   shown: number
   * }}
   */
  let { meta, view = $bindable(), total, shown } = $props();
</script>

<div
  class="fixed inset-x-0 top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70"
>
  <div class="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2.5">
    <div class="mr-1 flex items-baseline gap-2">
      <span class="text-sm font-bold tracking-tight text-ink">国会ビジュアライザー</span>
      <span class="rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-deep">
        第{meta.session}回国会
      </span>
    </div>

    <!-- View toggle (primary) -->
    <div class="flex rounded-pill border border-line bg-surface p-0.5 text-sm">
      <button
        type="button"
        onclick={() => (view = 'simple')}
        class="rounded-pill px-3 py-1 transition-colors {view === 'simple'
          ? 'bg-accent text-on-accent'
          : 'text-ink-soft hover:text-ink'}"
      >
        まとめ
      </button>
      <button
        type="button"
        onclick={() => (view = 'board')}
        class="rounded-pill px-3 py-1 transition-colors {view === 'board'
          ? 'bg-accent text-on-accent'
          : 'text-ink-soft hover:text-ink'}"
      >
        ボード
      </button>
      <button
        type="button"
        onclick={() => (view = 'recent')}
        class="rounded-pill px-3 py-1 transition-colors {view === 'recent'
          ? 'bg-accent text-on-accent'
          : 'text-ink-soft hover:text-ink'}"
      >
        動き
      </button>
    </div>

    <div class="ml-auto flex items-center gap-2.5">
      <span class="text-xs text-ink-faint tabular-nums notranslate">
        {shown} / {total} 件
      </span>
      <TranslateMenu />
      <ThemeToggle />
    </div>
  </div>
</div>
