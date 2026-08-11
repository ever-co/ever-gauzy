/**
 * Keyboard shortcuts of the Documents browse surface (`01-ux-spec.md` §16/§17).
 *
 * Kept as a pure function rather than a method on the page component so the
 * mapping — and, more importantly, every case where a keypress must NOT be
 * hijacked — can be tested without instantiating the component (and therefore
 * without pulling the whole Angular module graph into the test runtime).
 *
 * 🛑 The tree owns its own keys through `ITreeOptions.actionMapping` on a
 * `body: keydown` listener, which runs BEFORE a `document: keydown` one (the
 * event bubbles body → document) and calls `preventDefault()` on anything it
 * handled. `defaultPrevented` is therefore the authoritative "someone else
 * already took this key" signal, and it is checked first.
 */
export type DocsBrowseShortcut = 'search' | 'upload' | 'new' | 'toggle-view' | 'dismiss';

/**
 * Ancestors that own their keystrokes.
 *
 * Text entry is the obvious one — `u` in the search box must type a `u` — but
 * `tree-root` matters just as much: the sidebar maps F2/Delete/Ctrl+↑↓ itself,
 * and `.cdk-overlay-container` covers a dialog or context menu that has taken
 * focus.
 */
export const DOCS_BROWSE_SHORTCUT_SKIP_SELECTOR = [
	'input',
	'textarea',
	'select',
	'[contenteditable="true"]',
	'[contenteditable=""]',
	'tree-root',
	'.cdk-overlay-container'
].join(', ');

/**
 * Selector matching an overlay that is currently open.
 *
 * A context menu does not necessarily move focus, so the skip-selector above
 * cannot catch it from the event target alone — the page checks the document for
 * one of these before acting on a shortcut. Deliberately narrow: `nbTooltip`
 * also renders into the overlay container, and a hovered tooltip must not
 * disable the whole keyboard map.
 */
export const DOCS_BROWSE_OVERLAY_SELECTOR = 'nb-dialog-container, nb-context-menu';

/**
 * DOM id of the free-text search box, as rendered by
 * `components/filter-bar/docs-filter-bar.component.html`.
 *
 * The `/` shortcut only moves focus, so it addresses the input by id rather than
 * reaching across component boundaries for a `@ViewChild` the filter bar does not
 * expose. Keep the two in step — a renamed id turns `/` into a silent no-op.
 */
export const DOCS_SEARCH_INPUT_ID = 'docs-filter-search';

/**
 * Maps a raw keydown to the browse action it requests, or `null` when the page
 * must keep its hands off the event.
 */
export function docsBrowseShortcutOf(event: KeyboardEvent): DocsBrowseShortcut | null {
	if (!event || event.defaultPrevented) return null;
	// Every modifier combination belongs to the browser or the OS: `Ctrl+V` is
	// paste, not "toggle the layout".
	if (event.ctrlKey || event.metaKey || event.altKey) return null;

	const target = event.target as HTMLElement | null;
	if (typeof target?.closest === 'function' && target.closest(DOCS_BROWSE_SHORTCUT_SKIP_SELECTOR)) return null;

	switch (event.key) {
		case '/':
			return 'search';
		case 'u':
		case 'U':
			return 'upload';
		case 'n':
		case 'N':
			return 'new';
		case 'v':
		case 'V':
			return 'toggle-view';
		case 'Escape':
			return 'dismiss';
		default:
			return null;
	}
}
