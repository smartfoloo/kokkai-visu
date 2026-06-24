<script>
  import { browser } from '$app/environment';
  import { recentActivity, formatDay } from '$lib/activity';
  import { partyColor, partyLabel } from '$lib/parties';

  /** @typedef {import('$lib/types.js').Bill} Bill */
  /** @typedef {import('$lib/types.js').Meta} Meta */
  /** @typedef {import('$lib/status.js').Tone} Tone */

  /** @type {{ bills: Bill[], meta: Meta, onselect: (b: Bill, rect: DOMRect) => void }} */
  let { bills, meta, onselect } = $props();

  const days = $derived(recentActivity(bills, meta.updatedAt));

  /** @type {Record<Tone, string>} */
  const dot = { new: '#a1a1aa', active: '#0d9488', done: '#16a34a', failed: '#71717a' };

  // Highlight events newer than the user's last visit, then record this visit.
  const LAST_SEEN_KEY = 'kokkai:lastSeen';
  let lastSeen = $state('');
  $effect(() => {
    if (!browser) return;
    lastSeen = localStorage.getItem(LAST_SEEN_KEY) ?? '';
    const newest = days[0]?.date;
    if (newest) localStorage.setItem(LAST_SEEN_KEY, newest);
  });

  /** @param {string} date */
  const isNew = (date) => !!lastSeen && date > lastSeen;
</script>

<div class="space-y-8">
  <header>
    <h1 class="text-xl font-bold text-ink sm:text-2xl">最近の動き</h1>
    <p class="mt-2 text-sm leading-relaxed text-ink-soft">
      国会で最近どの法案が動いたかを、新しい順にまとめています（{meta.updatedAt} 時点）。
      カードを押すと、その法案のくわしい内容が見られます。
    </p>
  </header>

  {#if days.length === 0}
    <p class="py-16 text-center text-ink-faint">最近の動きはまだありません。</p>
  {/if}

  {#each days as day (day.date)}
    <section>
      <div class="mb-3 flex items-baseline gap-2">
        <h2 class="text-lg font-bold text-ink">{formatDay(day.date)}</h2>
        <span
          class="rounded-badge bg-surface-2 px-2 py-0.5 text-xs font-medium tabular-nums text-ink-soft"
        >
          {day.events.length}件
        </span>
      </div>

      <div class="space-y-2">
        {#each day.events as e, i (e.bill.id + e.label + i)}
          <button
            type="button"
            onclick={(ev) => onselect(e.bill, ev.currentTarget.getBoundingClientRect())}
            class="flex w-full items-start gap-3 rounded-card border border-line bg-surface p-3.5 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-2 sm:p-4"
          >
            <span
              class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style="background:{dot[e.tone]}"
            ></span>

            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="rounded-badge bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-soft">
                  {e.label}
                </span>
                {#if e.house}
                  <span class="text-xs text-ink-faint">
                    {e.house}議院{#if e.detail} · {e.detail}{/if}
                  </span>
                {/if}
                {#if isNew(e.date)}
                  <span class="rounded-badge bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-amber-ink">
                    NEW
                  </span>
                {/if}
              </span>

              <span class="mt-1 block text-[15px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                {e.bill.ai?.plainTitle ?? e.bill.title}
              </span>

              <span class="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  style="background:{partyColor(e.bill.submitterParty)}"
                ></span>
                {partyLabel(e.bill.submitterParty)} · {e.bill.category}
              </span>
            </span>

            <svg
              class="mt-1 h-4 w-4 shrink-0 text-ink-faint"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 4l4 4-4 4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        {/each}
      </div>
    </section>
  {/each}
</div>
