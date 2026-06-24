<script>
  import { simpleStatus, FEED_GROUPS } from '$lib/status';
  import SimpleCard from './SimpleCard.svelte';

  /** @typedef {import('$lib/types.js').Bill} Bill */
  /** @typedef {import('$lib/types.js').Meta} Meta */
  /** @typedef {import('$lib/status.js').Tone} Tone */
  /** @typedef {{ key: string, heading: string, blurb?: string, list: Bill[] }} Group */

  /**
   * @type {{
   *   bills: Bill[],
   *   meta: Meta,
   *   groupBy: 'status' | 'category',
   *   onselect: (b: Bill, rect: DOMRect) => void
   * }}
   */
  let { bills, meta, groupBy, onselect } = $props();

  const groups = $derived.by(() => {
    if (groupBy === 'category') {
      /** @type {Map<string, Bill[]>} */
      const m = new Map();
      for (const b of bills) {
        const arr = m.get(b.category);
        if (arr) arr.push(b);
        else m.set(b.category, [b]);
      }
      // Order by meta.categories, then any leftovers.
      return /** @type {Group[]} */ (
        meta.categories
          .filter((c) => m.has(c))
          .map((c) => ({ key: c, heading: c, list: m.get(c) ?? [] }))
      );
    }
    /** @type {Record<Tone, Bill[]>} */
    const byTone = { active: [], new: [], done: [], failed: [] };
    for (const b of bills) byTone[simpleStatus(b).tone].push(b);
    return /** @type {Group[]} */ (
      FEED_GROUPS.filter((g) => byTone[g.key].length).map((g) => ({
        key: g.key,
        heading: g.heading,
        blurb: g.blurb,
        list: byTone[g.key]
      }))
    );
  });
</script>

<div class="space-y-10">
  {#each groups as g (g.key)}
    <section>
      <div class="mb-1 flex items-baseline gap-2">
        <h2 class="text-lg font-bold text-ink">{g.heading}</h2>
        <span class="rounded-badge bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-soft tabular-nums">
          {g.list.length}
        </span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each g.list as bill (bill.id)}
          <SimpleCard {bill} {onselect} />
        {/each}
      </div>
    </section>
  {/each}

  {#if bills.length === 0}
    <p class="py-16 text-center text-ink-faint">条件に合う法案が見つかりませんでした。</p>
  {/if}
</div>
