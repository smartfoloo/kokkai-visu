<script>
  /** @typedef {{ value: string, label: string, color?: string }} Option */

  /**
   * @type {{
   *   value: string,
   *   options: Option[],
   *   placeholder: string,
   *   align?: 'left' | 'right',
   *   label?: string
   * }}
   */
  let {
    value = $bindable(),
    options,
    placeholder,
    align = 'left',
    label
  } = $props();

  let open = $state(false);
  /** @type {HTMLDivElement} */
  let root;

  const current = $derived(options.find((o) => o.value === value));

  /** @param {string} v */
  function choose(v) {
    value = v;
    open = false;
  }

  /** @param {MouseEvent} e */
  function onWindowClick(e) {
    if (open && root && !root.contains(/** @type {Node} */ (e.target))) open = false;
  }
  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:window on:click={onWindowClick} on:keydown={onKey} />

<div class="relative" bind:this={root}>
  <button
    type="button"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={label ?? placeholder}
    onclick={() => (open = !open)}
    class="pill bg-surface {value ? 'pill-active' : ''} {open ? 'border-accent/40' : ''}"
  >
    {#if current?.color}
      <span class="h-2 w-2 shrink-0 rounded-full" style="background:{current.color}"></span>
    {/if}
    <span class="max-w-[10rem] truncate">{current ? current.label : placeholder}</span>
    <svg
      class="h-3 w-3 shrink-0 text-ink-faint transition-transform {open ? 'rotate-180' : ''}"
      viewBox="0 0 12 12"
      fill="none"
    >
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>

  {#if open}
    <div
      role="listbox"
      tabindex="-1"
      class="absolute z-40 mt-1.5 max-h-72 min-w-[12rem] overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-card-hover {align === 'right' ? 'right-0' : 'left-0'}"
    >
      <button
        type="button"
        role="option"
        aria-selected={!value}
        onclick={() => choose('')}
        class="flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-sm text-ink-soft hover:bg-surface-2 {!value ? 'bg-surface-2' : ''}"
      >
        <span class="flex-1">{placeholder}</span>
        {#if !value}<span class="text-accent">✓</span>{/if}
      </button>
      {#each options as o (o.value)}
        <button
          type="button"
          role="option"
          aria-selected={value === o.value}
          onclick={() => choose(o.value)}
          class="flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-2 {value === o.value ? 'bg-accent-soft' : ''}"
        >
          {#if o.color}
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{o.color}"></span>
          {/if}
          <span class="flex-1 truncate">{o.label}</span>
          {#if value === o.value}<span class="text-accent">✓</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
