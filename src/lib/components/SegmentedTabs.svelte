<script>
  /** @typedef {{ value: string, label: string }} Tab */

  /**
   * Tab switcher with two looks:
   *  - `segment` (default): Chakra SegmentGroup — a muted track with a light,
   *    elevated indicator that slides to the active tab.
   *  - `plain`: Chakra Tabs (subtle) — no track; the active tab alone gets a
   *    muted fill, inactive tabs are plain muted text.
   *
   * @type {{
   *   value: string,
   *   options: Tab[],
   *   ariaLabel?: string,
   *   variant?: 'segment' | 'plain',
   *   class?: string
   * }}
   */
  let { value = $bindable(), options, ariaLabel, variant = 'segment', class: klass = '' } = $props();

  const n = $derived(options.length);
  const activeIndex = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
</script>

{#if variant === 'plain'}
  <div role="tablist" aria-label={ariaLabel} class="flex items-center gap-1 {klass}">
    {#each options as o (o.value)}
      <button
        type="button"
        role="tab"
        aria-selected={value === o.value}
        onclick={() => (value = o.value)}
        class="whitespace-nowrap rounded-control px-3 py-1.5 text-sm transition-colors {value ===
        o.value
          ? 'bg-surface-2 font-medium text-ink'
          : 'text-ink-soft hover:bg-surface-2/60 hover:text-ink'}"
      >
        {o.label}
      </button>
    {/each}
  </div>
{:else}
  <div
    role="tablist"
    aria-label={ariaLabel}
    class="relative inline-grid auto-cols-fr grid-flow-col items-stretch rounded-control bg-surface-2 p-1 text-sm {klass}"
  >
    <!-- Sliding active indicator — Chakra SegmentGroup: elevated light panel -->
    <span
      aria-hidden="true"
      class="pointer-events-none absolute bottom-1 left-1 top-1 rounded-badge bg-surface shadow-card transition-transform duration-200 ease-out"
      style="width: calc((100% - 0.5rem) / {n}); transform: translateX({activeIndex * 100}%);"
    ></span>

    {#each options as o (o.value)}
      <button
        type="button"
        role="tab"
        aria-selected={value === o.value}
        onclick={() => (value = o.value)}
        class="relative z-10 whitespace-nowrap rounded-badge px-3 py-1 text-center leading-5 transition-colors {value ===
        o.value
          ? 'font-medium text-ink'
          : 'text-ink-soft hover:text-ink'}"
      >
        {o.label}
      </button>
    {/each}
  </div>
{/if}
