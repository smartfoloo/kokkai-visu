<script>
  import { buildDigest } from '$lib/digest';
  import { simpleStatus } from '$lib/status';
  import { partyColor, partyLabel } from '$lib/parties';
  import { boldSegments } from '$lib/richtext';
  import SimpleCard from './SimpleCard.svelte';

  /** @typedef {import('$lib/types.js').Bill} Bill */
  /** @typedef {import('$lib/types.js').Meta} Meta */
  /** @typedef {import('$lib/digest.js').SeeAll} SeeAll */

  /**
   * @type {{
   *   bills: Bill[],
   *   meta: Meta,
   *   asOf: string,
   *   onselect: (b: Bill, rect: DOMRect) => void,
   *   onseeall: (s: SeeAll & { category?: string }) => void
   * }}
   */
  let { bills, meta, asOf, onselect, onseeall } = $props();

  const digest = $derived(buildDigest(bills, asOf));
  const featured = $derived(digest.featured);

  const heroStatus = $derived(featured ? simpleStatus(featured) : null);
  const heroTitle = $derived(featured ? (featured.ai?.plainTitle ?? featured.title) : '');
</script>

<div class="space-y-10">
  <!-- Hero: 今週の一本 -->
  {#if featured}
    {@const f = featured}
    <section>
      <div class="mb-2.5 flex items-baseline gap-2">
        <h2 class="text-lg font-bold text-ink">今週の一本</h2>
        <span class="text-xs text-ink-faint">いま注目の法案</span>
      </div>
      <button
        type="button"
        onclick={(e) => onselect(f, e.currentTarget.getBoundingClientRect())}
        class="flex w-full flex-col gap-3 rounded-card border border-line bg-surface p-5 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-2 sm:p-6"
      >
        <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <span class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" style="background:{partyColor(f.submitterParty)}"></span>
            {partyLabel(f.submitterParty)}
          </span>
          <span class="text-ink-faint/50">·</span>
          {f.category}
          {#if heroStatus}
            <span class="text-ink-faint/50">·</span>
            <span class="font-medium text-ink-soft">{heroStatus.label}</span>
          {/if}
        </span>
        <h3 class="text-xl font-bold leading-snug text-ink [overflow-wrap:anywhere] sm:text-2xl">
          {heroTitle}
        </h3>
        {#if f.ai?.oneLiner}
          <p class="text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere]">
            {#each boldSegments(f.ai.oneLiner) as seg}{#if seg.bold}<strong
                  class="font-semibold text-ink">{seg.text}</strong>{:else}{seg.text}{/if}{/each}
          </p>
        {/if}
      </button>
    </section>
  {/if}

  <!-- Curated sections -->
  {#each digest.sections as g (g.key)}
    <section>
      <div class="mb-1 flex items-baseline gap-2">
        <h2 class="text-lg font-bold text-ink">{g.heading}</h2>
        <span class="rounded-badge bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-soft tabular-nums">
          {g.bills.length}
        </span>
        <button
          type="button"
          onclick={() => onseeall(g.seeAll)}
          class="ml-auto inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-medium text-accent-deep transition-colors hover:bg-accent-soft"
        >
          すべて見る →
        </button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each g.bills as bill (bill.id)}
          <SimpleCard {bill} {onselect} />
        {/each}
      </div>
    </section>
  {/each}

  {#if !featured && digest.sections.length === 0}
    <p class="py-16 text-center text-ink-faint">いま注目の動きはありません。「一覧」からすべての法案を見られます。</p>
  {/if}
</div>
