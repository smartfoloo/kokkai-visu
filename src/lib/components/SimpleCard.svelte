<script>
  import { partyColor, partyLabel } from '$lib/parties';
  import { simpleStatus } from '$lib/status';

  /** @typedef {import('$lib/types.js').Bill} Bill */
  /** @typedef {import('$lib/status.js').Tone} Tone */

  /** @type {{ bill: Bill, onselect: (b: Bill, rect: DOMRect) => void }} */
  let { bill, onselect } = $props();

  const status = $derived(simpleStatus(bill));

  /** @type {Record<Tone, string>} */
  const dot = {
    new: '#a1a1aa',
    active: '#0d9488',
    done: '#16a34a',
    failed: '#71717a'
  };

  // Prefer the AI plain-language title; fall back to the official text.
  const title = $derived(bill.ai?.plainTitle ?? bill.title);
</script>

<button
  type="button"
  onclick={(e) => onselect(bill, e.currentTarget.getBoundingClientRect())}
  class="flex w-full flex-col gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-2 sm:p-5"
>
  <div class="flex items-center justify-between gap-3">
    <span class="flex items-center gap-1.5 text-xs text-ink-faint">
      <span class="h-2 w-2 rounded-full" style="background:{partyColor(bill.submitterParty)}"></span>
      {partyLabel(bill.submitterParty)}
      <span class="text-ink-faint/50">·</span>
      {bill.category}
    </span>
    <span class="flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-soft">
      <span class="h-2 w-2 rounded-full" style="background:{dot[status.tone]}"></span>
      {status.label}
    </span>
  </div>

  <h3 class="text-[15px] font-bold leading-snug text-ink [overflow-wrap:anywhere]">
    {title}
  </h3>
</button>
