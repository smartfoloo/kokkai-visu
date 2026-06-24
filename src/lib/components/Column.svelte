<script>
  import BillCard from './BillCard.svelte';

  /** @typedef {import('$lib/types.js').Bill} Bill */
  /** @typedef {import('$lib/types.js').Stage} Stage */

  /**
   * @type {{
   *   label: string,
   *   sub?: string,
   *   stage: Stage,
   *   bills: Bill[],
   *   onselect: (b: Bill, rect: DOMRect) => void
   * }}
   */
  let { label, sub, stage, bills, onselect } = $props();
</script>

<section class="flex h-full min-h-0 min-w-[260px] flex-1 flex-col">
  <header class="mb-2 flex items-baseline justify-between px-1">
    <div>
      <h2 class="text-sm font-semibold text-ink">{label}</h2>
      {#if sub}<p class="text-[11px] uppercase tracking-wide text-ink-faint">{sub}</p>{/if}
    </div>
    <span
      class="rounded-badge bg-surface-2 px-2 py-0.5 text-xs font-medium tabular-nums text-ink-soft"
    >
      {bills.length}
    </span>
  </header>

  <div
    class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto rounded-card bg-canvas-deep/40 p-2"
  >
    {#each bills as bill (bill.id)}
      <BillCard {bill} {onselect} />
    {:else}
      <p class="px-2 py-8 text-center text-xs text-ink-faint">該当なし</p>
    {/each}
  </div>
</section>
