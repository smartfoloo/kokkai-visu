<script>
  import { partyColor, partyFor, partyLabel } from '$lib/parties';
  import { boldSegments } from '$lib/richtext';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';

  /** @typedef {import('$lib/types.js').Bill} Bill */

  /** @type {{ bill: Bill | null, origin: DOMRect | null, onclose: () => void }} */
  let { bill, origin, onclose } = $props();

  /** @param {string} name */
  function chipStyle(name) {
    const c = partyFor(name).color;
    return `background:${c}1a;color:${c};border:1px solid ${c}40`;
  }

  // iOS-style expand: the window grows from the tapped card's rect to its final
  // centered position (FLIP — map final rect back onto the origin, animate to identity).
  /**
   * @param {HTMLElement} node
   * @param {{ duration?: number }} [params]
   */
  function expandFrom(node, { duration = 380 } = {}) {
    const target = node.getBoundingClientRect();
    if (!origin || target.width === 0) {
      return { duration, easing: cubicOut, css: (/** @type {number} */ t) => `opacity:${t}` };
    }
    const dx = origin.left + origin.width / 2 - (target.left + target.width / 2);
    const dy = origin.top + origin.height / 2 - (target.top + target.height / 2);
    const sx = origin.width / target.width;
    const sy = origin.height / target.height;
    return {
      duration,
      easing: cubicOut,
      css: (/** @type {number} */ t, /** @type {number} */ u) =>
        `transform: translate(${dx * u}px, ${dy * u}px) scale(${sx + (1 - sx) * t}, ${
          sy + (1 - sy) * t
        }); opacity: ${Math.min(1, t * 1.6)};`
    };
  }
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === 'Escape' && bill) onclose();
  }}
/>

{#if bill}
  <div class="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6">
    <!-- backdrop -->
    <button
      type="button"
      aria-label="閉じる"
      class="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
      onclick={onclose}
      transition:fade={{ duration: 200 }}
    ></button>

    <!-- macOS-style window -->
    <div
      class="relative flex max-h-[86vh] w-full max-w-[760px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
      style="transform-origin: center center;"
      role="dialog"
      aria-modal="true"
      aria-label={bill.title}
      transition:expandFrom
    >
      <!-- title bar with traffic lights -->
      <div
        class="flex shrink-0 items-center gap-2 border-b border-line bg-canvas-deep/60 px-4 py-2.5"
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={onclose}
            aria-label="閉じる"
            class="group h-3.5 w-3.5 rounded-full"
            style="background:#ff5f57"
          >
            <span
              class="flex h-full w-full items-center justify-center text-[9px] font-bold leading-none text-black/55 opacity-0 group-hover:opacity-100"
              >✕</span
            >
          </button>
          <span class="h-3.5 w-3.5 rounded-full" style="background:#febc2e"></span>
          <span class="h-3.5 w-3.5 rounded-full" style="background:#28c840"></span>
        </div>
        <p class="mx-auto truncate px-2 text-xs font-medium text-ink-soft [overflow-wrap:anywhere]">
          {bill.ai?.plainTitle ?? bill.title}
        </p>
        <span class="h-3.5 w-9 shrink-0"></span>
      </div>

      <div class="flex-1 space-y-6 overflow-y-auto p-6">
        <!-- header -->
        <header>
          <div class="mb-2 flex flex-wrap items-center gap-1.5">
            <span class="tag bg-canvas-deep text-ink-soft">{bill.billType}</span>
            <span class="tag bg-surface-2 text-ink-soft">{bill.category}</span>
            <span class="tag bg-accent-soft text-accent-deep">{bill.status}</span>
          </div>
          <h2 class="text-xl font-bold leading-snug text-ink [overflow-wrap:anywhere]">
            {bill.ai?.plainTitle ?? bill.title}
          </h2>
          {#if bill.ai?.plainTitle && bill.ai.plainTitle !== bill.title}
            <p class="mt-1 text-xs text-ink-faint [overflow-wrap:anywhere]">正式名称: {bill.title}</p>
          {/if}
          <p class="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              style="background:{partyColor(bill.submitterParty)}"
            ></span>
            提出: {bill.submitter} · {partyLabel(bill.submitterParty)}
          </p>
        </header>

        <!-- inline **bold** renderer (XSS-safe, no @html) -->
        {#snippet rich(/** @type {string} */ text)}{#each boldSegments(text) as seg}{#if seg.bold}<strong
                class="font-semibold text-ink">{seg.text}</strong>{:else}{seg.text}{/if}{/each}{/snippet}

        <!-- AI explanation (みらい議会 style) -->
        {#if bill.ai}
          {#if bill.ai.oneLiner}
            <p class="text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">
              {@render rich(bill.ai.oneLiner)}
            </p>
          {/if}

          <!-- 概要 -->
          {#if bill.ai.description.length}
            <section>
              <h3 class="mb-1.5 text-[15px] font-bold leading-snug text-ink">概要</h3>
              <ul class="space-y-1.5">
                {#each bill.ai.description as b}
                  <li class="flex gap-2 text-sm leading-relaxed text-ink-soft">
                    <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60"></span>
                    <span class="[overflow-wrap:anywhere]">{@render rich(b)}</span>
                  </li>
                {/each}
              </ul>
            </section>
          {/if}

          <!-- なぜ重要か -->
          {#if bill.ai.whyItMatters}
            <section>
              <h3 class="mb-1.5 text-[15px] font-bold leading-snug text-ink">なぜ重要か</h3>
              <p class="text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere]">
                {@render rich(bill.ai.whyItMatters)}
              </p>
            </section>
          {/if}

          <!-- 変わること（前 → 後） -->
          {#if bill.ai.beforeAfter.length}
            <section>
              <h3 class="mb-2 text-[15px] font-bold leading-snug text-ink">変わること</h3>
              <div class="space-y-2">
                {#each bill.ai.beforeAfter as ba}
                  <div class="rounded-card border border-line bg-surface-2 p-3 text-sm leading-relaxed">
                    <div class="flex items-start gap-2">
                      <span class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-ink-faint bg-canvas-deep">現状</span>
                      <span class="text-ink-soft [overflow-wrap:anywhere]">{@render rich(ba.before)}</span>
                    </div>
                    <div class="my-1 text-center text-ink-faint" aria-hidden="true">↓</div>
                    <div class="flex items-start gap-2">
                      <span class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-accent-deep bg-accent-soft">改正後</span>
                      <span class="text-ink [overflow-wrap:anywhere]">{@render rich(ba.after)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </section>
          {/if}

          <!-- 賛成・反対の論点（実際の審議・採決にもとづく） -->
          {#if bill.ai.arguments && bill.ai.arguments.for.length && bill.ai.arguments.against.length}
            {@const args = bill.ai.arguments}
            <section>
              <h3 class="mb-1 text-[15px] font-bold leading-snug text-ink">賛成・反対の論点</h3>
              <p class="mb-2 text-[11px] text-ink-faint">実際の国会審議・採決での発言にもとづきます。</p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {#each [{ key: 'for', label: '賛成の論点', dot: 'bg-accent', points: args.for }, { key: 'against', label: '反対の論点', dot: 'bg-amber', points: args.against }] as col}
                  {#if col.points.length}
                    <div class="rounded-card border border-line bg-surface-2 p-3">
                      <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <span class="h-2 w-2 shrink-0 rounded-full {col.dot}"></span>{col.label}
                      </p>
                      <ul class="space-y-2">
                        {#each col.points as p}
                          <li class="text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere]">
                            {@render rich(p.point)}
                            {#if p.party}
                              <span class="ml-1 inline-block align-middle tag" style={chipStyle(p.party)}>{p.party}</span>
                            {/if}
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                {/each}
              </div>
            </section>
          {/if}

          {#if bill.ai.sources.length}
            <section>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                参考にした情報
              </h3>
              <ul class="space-y-1">
                {#each bill.ai.sources as src}
                  <li>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener"
                      class="text-xs text-accent hover:underline [overflow-wrap:anywhere]"
                    >
                      {src.title} ↗
                    </a>
                  </li>
                {/each}
              </ul>
            </section>
          {/if}
        {:else}
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">概要</h3>
            <p class="text-sm text-ink-faint">
              やさしい解説は準備中です。下部の公式リンクから議案要旨・本文をご確認ください。
            </p>
          </section>
        {/if}

        <!-- Votes -->
        {#if bill.votes.length}
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">採決</h3>
            <div class="space-y-3">
              {#each bill.votes as v}
                <div class="rounded-card border border-line bg-surface-2 p-3">
                  <div class="mb-2 flex items-center justify-between text-xs text-ink-soft">
                    <span class="font-semibold text-ink">{v.house}議院</span>
                    <span>{[v.attitude, v.result, v.method].filter(Boolean).join(' · ')}</span>
                  </div>

                  {#if v.tally}
                    {@const total = v.tally.for + v.tally.against}
                    <div class="mb-1 flex h-2 overflow-hidden rounded-pill bg-canvas-deep">
                      <div class="bg-accent" style="width:{(v.tally.for / total) * 100}%"></div>
                      <div class="bg-amber" style="width:{(v.tally.against / total) * 100}%"></div>
                    </div>
                    <div class="flex justify-between text-[11px] text-ink-faint tabular-nums">
                      <span>賛成 {v.tally.for}</span><span>反対 {v.tally.against}</span>
                    </div>
                  {/if}

                  {#if v.forParties.length}
                    <p class="mt-2 mb-1 text-[11px] text-ink-faint">賛成会派</p>
                    <div class="flex flex-wrap gap-1">
                      {#each v.forParties as p}
                        <span class="tag" style={chipStyle(p)}>{p}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if v.againstParties.length}
                    <p class="mt-2 mb-1 text-[11px] text-ink-faint">反対会派</p>
                    <div class="flex flex-wrap gap-1">
                      {#each v.againstParties as p}
                        <span class="tag" style={chipStyle(p)}>{p}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Timeline -->
        {#if bill.timeline.length}
          <section>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">経過</h3>
            <ol class="relative ml-1 space-y-3 border-l border-line pl-4">
              {#each bill.timeline as ev}
                <li class="relative">
                  <span
                    class="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface"
                    style="background:{ev.house === '参' ? '#2f6fb0' : '#e7c483'}"
                  ></span>
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="text-sm text-ink">{ev.label}</span>
                    <time class="shrink-0 text-[11px] text-ink-faint tabular-nums">{ev.date}</time>
                  </div>
                  {#if ev.detail}
                    <span class="text-[11px] text-ink-faint">{ev.detail}</span>
                  {/if}
                </li>
              {/each}
            </ol>
          </section>
        {/if}

        <!-- Links -->
        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">公式情報</h3>
          <div class="flex flex-wrap gap-2">
            {#if bill.links.detail}
              <a href={bill.links.detail} target="_blank" rel="noopener" class="pill hover:border-accent/40 hover:text-accent-deep">議案要旨（参）↗</a>
            {/if}
            {#if bill.links.progress}
              <a href={bill.links.progress} target="_blank" rel="noopener" class="pill hover:border-accent/40 hover:text-accent-deep">経過情報（衆）↗</a>
            {/if}
            {#if bill.links.fullText}
              <a href={bill.links.fullText} target="_blank" rel="noopener" class="pill hover:border-accent/40 hover:text-accent-deep">本文↗</a>
            {/if}
            {#if bill.links.outlinePdf}
              <a href={bill.links.outlinePdf} target="_blank" rel="noopener" class="pill hover:border-accent/40 hover:text-accent-deep">要旨PDF↗</a>
            {/if}
          </div>
        </section>
      </div>
    </div>
  </div>
{/if}
