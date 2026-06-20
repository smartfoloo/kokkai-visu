<script>
  import { browser } from '$app/environment';

  /** Languages offered to Google Website Translate (source page is Japanese). */
  const LANGS = [
    { value: 'ja', label: '日本語' },
    { value: 'en', label: 'English' },
    { value: 'zh-CN', label: '简体中文' },
    { value: 'zh-TW', label: '繁體中文' },
    { value: 'ko', label: '한국어' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'pt', label: 'Português' },
    { value: 'ru', label: 'Русский' },
    { value: 'ar', label: 'العربية' },
    { value: 'hi', label: 'हिन्दी' },
    { value: 'vi', label: 'Tiếng Việt' }
  ];

  let open = $state(false);
  let current = $state('ja');
  /** @type {HTMLDivElement} */
  let root;

  /** Read the active translation language from Google's `googtrans` cookie. */
  function readCurrent() {
    if (!browser) return 'ja';
    const m = document.cookie.match(/googtrans=\/[^/]+\/([^;]+)/);
    const lang = m ? decodeURIComponent(m[1]) : 'ja';
    return lang === 'ja' ? 'ja' : lang;
  }

  $effect(() => {
    current = readCurrent();
  });

  /** @param {string} lang @param {number} [maxAge] */
  function setCookie(lang, maxAge) {
    const v = '/ja/' + lang;
    const exp = maxAge === -1 ? ';expires=Thu, 01 Jan 1970 00:00:00 GMT' : '';
    const base = 'googtrans=' + (maxAge === -1 ? '' : v) + ';path=/';
    document.cookie = base + exp;
    const h = location.hostname;
    document.cookie = base + ';domain=' + h + exp;
    document.cookie = base + ';domain=.' + h + exp;
  }

  /** @param {string} lang */
  function choose(lang) {
    open = false;
    if (lang === current) return;
    current = lang;

    if (lang === 'ja') {
      // Restore the original Japanese page.
      setCookie('', -1);
      location.reload();
      return;
    }

    setCookie(lang);
    const combo = /** @type {HTMLSelectElement | null} */ (
      document.querySelector('.goog-te-combo')
    );
    if (combo) {
      combo.value = lang;
      combo.dispatchEvent(new Event('change'));
    } else {
      // Widget not ready yet — the cookie will be applied on reload.
      location.reload();
    }
  }

  /** @param {MouseEvent} e */
  function onWindowClick(e) {
    if (open && root && !root.contains(/** @type {Node} */ (e.target))) open = false;
  }
  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === 'Escape') open = false;
  }

  const currentLabel = $derived(LANGS.find((l) => l.value === current)?.label ?? '日本語');
</script>

<svelte:window on:click={onWindowClick} on:keydown={onKey} />

<div class="relative" bind:this={root}>
  <button
    type="button"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label="言語を変更 / Change language"
    title={currentLabel}
    onclick={() => (open = !open)}
    class="inline-flex h-7 w-7 items-center justify-center rounded-pill transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 {open
      ? 'bg-surface-2 text-ink'
      : current !== 'ja'
        ? 'bg-transparent text-accent-deep hover:bg-surface-2'
        : 'bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink'}"
  >
    <!-- Hugeicons Translate -->
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 5.82759H7.7M11 5.82759H9.5M7.7 5.82759H9.5M7.7 5.82759V5M9.5 5.82759C9.18351 6.95937 8.52075 8.02923 7.76429 8.96946M5.83571 11C6.44723 10.4377 7.13788 9.74802 7.76429 8.96946M7.76429 8.96946C7.37857 8.51724 6.83857 7.78558 6.68429 7.45455M7.76429 8.96946L8.92143 10.1724"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
      <path
        d="M13.5 19L14.3333 17M18.5 19L17.6667 17M14.3333 17L16 13L17.6667 17M14.3333 17H17.6667"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
      <path
        d="M14 10V8C14 5.17157 14 3.75736 13.1213 2.87868C12.2426 2 10.8284 2 8 2C5.17157 2 3.75736 2 2.87868 2.87868C2 3.75736 2 5.17157 2 8C2 10.8284 2 12.2426 2.87868 13.1213C3.75736 14 5.17157 14 8 14H10"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
      />
      <path
        d="M10 16C10 13.1716 10 11.7574 10.8787 10.8787C11.7574 10 13.1716 10 16 10C18.8284 10 20.2426 10 21.1213 10.8787C22 11.7574 22 13.1716 22 16C22 18.8284 22 20.2426 21.1213 21.1213C20.2426 22 18.8284 22 16 22C13.1716 22 11.7574 22 10.8787 21.1213C10 20.2426 10 18.8284 10 16Z"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M4 16.5C4 17.9045 4 18.6067 4.33706 19.1111C4.48298 19.3295 4.67048 19.517 4.88886 19.6629C5.39331 20 6.09554 20 7.5 20"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
      <path
        d="M20 7.5C20 6.09554 20 5.39331 19.6629 4.88886C19.517 4.67048 19.3295 4.48298 19.1111 4.33706C18.6067 4 17.9045 4 16.5 4"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  </button>

  {#if open}
    <div
      role="listbox"
      tabindex="-1"
      class="absolute right-0 z-40 mt-1.5 max-h-72 min-w-[10rem] overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-card-hover"
    >
      <div class="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        Translate · 翻訳
      </div>
      {#each LANGS as l (l.value)}
        <button
          type="button"
          role="option"
          aria-selected={current === l.value}
          onclick={() => choose(l.value)}
          class="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-2 {current ===
          l.value
            ? 'bg-accent-soft'
            : ''}"
        >
          <span class="flex-1 truncate notranslate">{l.label}</span>
          {#if current === l.value}<span class="text-accent">✓</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
