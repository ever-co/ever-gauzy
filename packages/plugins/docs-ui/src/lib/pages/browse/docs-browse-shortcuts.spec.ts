/**
 * Browse keyboard-shortcut mapping (`01-ux-spec.md` §16/§17).
 *
 * The mapping lives in a pure module precisely so this suite can exercise it
 * without instantiating `DocsBrowsePageComponent`, which reaches the
 * `@gauzy/ui-core/shared` barrel through its base class.
 */
import { docsBrowseShortcutOf } from './docs-browse-shortcuts';

/**
 * Minimal `KeyboardEvent` stand-in. jsdom's real constructor cannot be given an
 * arbitrary `target`, which is exactly what the skip rules are read from.
 */
function keydown(key: string, overrides: Record<string, unknown> = {}): KeyboardEvent {
	return {
		key,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		defaultPrevented: false,
		target: null,
		...overrides
	} as unknown as KeyboardEvent;
}

/** An element whose `closest()` answers for the given selector fragments. */
function elementMatching(...matches: string[]): Record<string, unknown> {
	return {
		closest: (selector: string) => (matches.some((match) => selector.includes(match)) ? {} : null)
	};
}

describe('docsBrowseShortcutOf', () => {
	it('maps the five documented keys', () => {
		expect(docsBrowseShortcutOf(keydown('/'))).toBe('search');
		expect(docsBrowseShortcutOf(keydown('u'))).toBe('upload');
		expect(docsBrowseShortcutOf(keydown('n'))).toBe('new');
		expect(docsBrowseShortcutOf(keydown('v'))).toBe('toggle-view');
		expect(docsBrowseShortcutOf(keydown('Escape'))).toBe('dismiss');
	});

	it('accepts the shifted (upper-case) letters — Shift is not a modifier here', () => {
		expect(docsBrowseShortcutOf(keydown('U', { shiftKey: true }))).toBe('upload');
		expect(docsBrowseShortcutOf(keydown('N', { shiftKey: true }))).toBe('new');
		expect(docsBrowseShortcutOf(keydown('V', { shiftKey: true }))).toBe('toggle-view');
	});

	it('ignores unmapped keys', () => {
		expect(docsBrowseShortcutOf(keydown('a'))).toBeNull();
		expect(docsBrowseShortcutOf(keydown('Enter'))).toBeNull();
	});

	describe('keys that belong to someone else', () => {
		it('declines a Ctrl combination — Ctrl+V is paste, not "toggle the layout"', () => {
			expect(docsBrowseShortcutOf(keydown('v', { ctrlKey: true }))).toBeNull();
		});

		it('declines a Meta combination', () => {
			expect(docsBrowseShortcutOf(keydown('v', { metaKey: true }))).toBeNull();
		});

		it('declines an Alt combination', () => {
			expect(docsBrowseShortcutOf(keydown('n', { altKey: true }))).toBeNull();
		});

		it('declines an event another handler already claimed', () => {
			// The tree maps its own keys on a `body: keydown` listener, which runs first
			// and calls preventDefault() — that flag is the handoff signal.
			expect(docsBrowseShortcutOf(keydown('u', { defaultPrevented: true }))).toBeNull();
		});

		it.each([
			['a text input', 'input'],
			['a textarea', 'textarea'],
			['a select', 'select'],
			['a rich-text surface', '[contenteditable="true"]'],
			['the documents tree', 'tree-root'],
			['an open overlay', '.cdk-overlay-container']
		])('declines a keypress inside %s', (_label, selector) => {
			expect(docsBrowseShortcutOf(keydown('u', { target: elementMatching(selector) }))).toBeNull();
		});

		it('still maps a keypress on an element that matches nothing', () => {
			expect(docsBrowseShortcutOf(keydown('u', { target: elementMatching() }))).toBe('upload');
		});

		it('survives a target without `closest` (document / window)', () => {
			expect(docsBrowseShortcutOf(keydown('u', { target: {} }))).toBe('upload');
		});
	});

	it('declines a missing event rather than throwing', () => {
		expect(docsBrowseShortcutOf(undefined as unknown as KeyboardEvent)).toBeNull();
	});
});
