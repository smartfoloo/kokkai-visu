<script>
  import { partyColor, partyLabel } from '$lib/parties';

  /** @typedef {import('$lib/types.js').Bill} Bill */

  /** @type {{ bill: Bill, onselect: (b: Bill, rect: DOMRect) => void }} */
  let { bill, onselect } = $props();

  const heatClass = $derived(
    bill.heat === 'hot'
      ? 'bg-heat-hot border-amber/50'
      : bill.heat === 'warm'
        ? 'bg-heat-warm border-amber/30'
        : 'bg-surface border-line'
  );

  const partyHue = $derived(partyColor(bill.submitterParty));
  const finalLabel = $derived(
    bill.finalState === '成立' ? '成立' : bill.finalState === '廃案' ? '廃案・未了' : null
  );
</script>

<button
  type="button"
  onclick={(e) => onselect(bill, e.currentTarget.getBoundingClientRect())}
  class="group flex w-full shrink-0 flex-col gap-2 overflow-hidden rounded-card border p-3 text-left shadow-card transition-shadow hover:shadow-card-hover {heatClass}"
>
  <div class="flex items-start justify-between gap-2">
    <span class="tag bg-surface-2 text-ink-soft">{bill.category}</span>
    {#if bill.heat !== 'normal'}
      <span class="tag bg-amber-soft text-amber-ink" title="この段階に長く留まっています">
        {bill.heat === 'hot' ? '滞留中' : 'やや停滞'}
      </span>
    {/if}
  </div>

  <h3 class="text-[13px] font-semibold leading-snug text-ink line-clamp-3 [overflow-wrap:anywhere]">
    {bill.ai?.plainTitle ?? bill.title}
  </h3>

  <div class="flex items-center justify-between gap-2 text-[11px] text-ink-faint">
    <span class="flex min-w-0 items-center gap-1.5">
      <span class="h-2 w-2 shrink-0 rounded-full" style="background:{partyHue}"></span>
      <span class="truncate" style="color:{partyHue}">{partyLabel(bill.submitterParty)}</span>
    </span>
    {#if finalLabel}
      <span class="shrink-0 font-medium text-ink-soft">{finalLabel}</span>
    {:else if bill.daysInStage != null}
      <span class="shrink-0 tabular-nums">この段階 {bill.daysInStage}日</span>
    {/if}
  </div>
</button>
