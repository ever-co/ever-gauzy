import hotkeys from 'hotkeys-js';
import { getDefaultQuickActionShortcuts, QUICK_ACTIONS_DIALOG_SHORTCUT } from './quick-action.definitions';
import {
	checkShortcut,
	formatShortcut,
	keyboardEventToKeyName,
	keyCodesToShortcut,
	keyCodeToKeyName,
	normalizeShortcut,
	QuickActionShortcutErrorEnum,
	ShortcutRecorder,
	ShortcutRecorderEvent,
	shortcutsConflict,
	validateQuickActionShortcut
} from './quick-action-shortcut.util';

/** Key codes hotkeys-js reports for a shortcut pressed in the order it is written. */
function codesOf(shortcut: string): number[] {
	return shortcut.split('+').map((key) => hotkeys.modifier[key.toLowerCase()] ?? key.toUpperCase().charCodeAt(0));
}

/** How the header turned key codes into a string before this change (kept to prove the defaults still match). */
function legacyPressedKeys(codes: number[]): string {
	return codes
		.map((code) =>
			hotkeys.modifierMap[code]
				? hotkeys.modifierMap[code].toString().replace('Key', '')
				: String.fromCharCode(code).toLowerCase()
		)
		.join('+');
}

/** A key event as the recorder reads it. */
function key(keyValue: string, init: Partial<ShortcutRecorderEvent> = {}): ShortcutRecorderEvent {
	return {
		key: keyValue,
		code: init.code ?? '',
		keyCode: init.keyCode ?? 0,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		metaKey: false,
		...init
	};
}

const DEFAULTS = getDefaultQuickActionShortcuts();

describe('quick-action-shortcut.util', () => {
	describe('normalizeShortcut', () => {
		it('lower-cases and trims, keeping the key order', () => {
			expect(normalizeShortcut('shift+I')).toBe('shift+i');
			expect(normalizeShortcut('A+E')).toBe('a+e');
			expect(normalizeShortcut(' Shift + I ')).toBe('shift+i');
			expect(normalizeShortcut('ctrl+Q')).toBe('ctrl+q');
		});

		it('puts the leading modifiers in canonical order and maps their aliases', () => {
			expect(normalizeShortcut('shift+ctrl+k')).toBe('ctrl+shift+k');
			expect(normalizeShortcut('Control+Shift+K')).toBe('ctrl+shift+k');
			expect(normalizeShortcut('cmd+k')).toBe('meta+k');
			expect(normalizeShortcut('option+x')).toBe('alt+x');
		});

		it('does not treat a modifier after a key as a modifier', () => {
			expect(normalizeShortcut('i+shift')).toBe('i+shift');
		});

		it('returns an empty string for nothing', () => {
			expect(normalizeShortcut('')).toBe('');
			expect(normalizeShortcut(null)).toBe('');
			expect(normalizeShortcut(undefined)).toBe('');
			expect(normalizeShortcut(' + ')).toBe('');
		});
	});

	describe('formatShortcut', () => {
		it('formats like the header always did', () => {
			for (const shortcut of Object.values(DEFAULTS)) {
				const legacy = shortcut
					.split('+')
					.map((part) => part.toUpperCase())
					.join(' + ');
				expect(formatShortcut(shortcut)).toBe(legacy);
			}
			expect(formatShortcut('')).toBe('');
		});
	});

	describe('keyCodesToShortcut', () => {
		it('reads every default shortcut exactly as the header used to', () => {
			for (const shortcut of Object.values({ ...DEFAULTS, quickActions: QUICK_ACTIONS_DIALOG_SHORTCUT })) {
				const codes = codesOf(shortcut);
				expect(legacyPressedKeys(codes)).toBe(shortcut.toLowerCase());
				expect(keyCodesToShortcut(codes)).toBe(normalizeShortcut(shortcut));
			}
		});

		it('matches whichever modifier went down first', () => {
			expect(keyCodesToShortcut([16, 17, 75])).toBe('ctrl+shift+k');
			expect(keyCodesToShortcut([17, 16, 75])).toBe('ctrl+shift+k');
		});

		it('keeps a modifier pressed after a key out of the combination', () => {
			expect(keyCodesToShortcut([73, 16])).toBe('i+shift');
		});

		it('names the keys that used to read as letters (F1 was "p", F4 was "s")', () => {
			expect(keyCodesToShortcut([112])).toBe('f1');
			expect(keyCodesToShortcut([115])).toBe('f4');
			expect(keyCodesToShortcut([37])).toBe('left');
		});

		it('returns an empty string when a key has no name', () => {
			expect(keyCodesToShortcut([101])).toBe('');
			expect(keyCodesToShortcut([73, 174])).toBe('');
		});
	});

	describe('keyboardEventToKeyName', () => {
		it('reads letters, digits and modifiers', () => {
			expect(keyboardEventToKeyName(key('i'))).toBe('i');
			expect(keyboardEventToKeyName(key('I'))).toBe('i');
			expect(keyboardEventToKeyName(key('7'))).toBe('7');
			expect(keyboardEventToKeyName(key('Shift'))).toBe('shift');
			expect(keyboardEventToKeyName(key('Control'))).toBe('ctrl');
			expect(keyboardEventToKeyName(key('Meta'))).toBe('meta');
		});

		it('falls back to the layout-independent code, then the key code', () => {
			expect(keyboardEventToKeyName(key('ф', { code: 'KeyA', keyCode: 65 }))).toBe('a');
			expect(keyboardEventToKeyName(key('!', { code: 'Digit1', keyCode: 49 }))).toBe('1');
			expect(keyboardEventToKeyName(key('<', { code: 'Comma', keyCode: 188 }))).toBe(',');
			expect(keyboardEventToKeyName(key('Unidentified', { keyCode: 0 }))).toBeNull();
		});

		it('names special keys', () => {
			expect(keyboardEventToKeyName(key('ArrowLeft'))).toBe('left');
			expect(keyboardEventToKeyName(key('Escape'))).toBe('esc');
			expect(keyboardEventToKeyName(key(' '))).toBe('space');
			expect(keyboardEventToKeyName(key('F5'))).toBe('f5');
			expect(keyboardEventToKeyName(key('Tab'))).toBe('tab');
		});

		it('agrees with the key codes hotkeys-js derives from the same key values', () => {
			const glyphs = new Set(['⌫', '↩', '⇪']);
			for (const [name, code] of Object.entries(hotkeys.keyMap)) {
				if (glyphs.has(name)) continue;
				expect([name, keyboardEventToKeyName(key(name))]).toEqual([name, keyCodeToKeyName(code)]);
			}
			for (const [name, code] of Object.entries(hotkeys.modifier)) {
				if (/^[a-z]+$/.test(name)) {
					expect([name, keyboardEventToKeyName(key(name))]).toEqual([name, keyCodeToKeyName(code)]);
				}
			}
		});
	});

	describe('checkShortcut', () => {
		it('accepts every default shortcut', () => {
			for (const shortcut of Object.values(DEFAULTS)) {
				expect([shortcut, checkShortcut(shortcut)]).toEqual([shortcut, null]);
			}
		});

		it('accepts letters, digits and punctuation, with Shift, one or two keys', () => {
			expect(checkShortcut('y')).toBeNull();
			expect(checkShortcut('9')).toBeNull();
			expect(checkShortcut('shift+/')).toBeNull();
			expect(checkShortcut('[')).toBeNull();
			expect(checkShortcut('shift+a+e')).toBeNull();
		});

		it('refuses combinations reserved by the browser or the operating system', () => {
			for (const shortcut of ['ctrl+k', 'ctrl+t', 'alt+x', 'meta+w', 'ctrl+shift+n', '/', "'"]) {
				expect([shortcut, checkShortcut(shortcut)?.code]).toEqual([
					shortcut,
					QuickActionShortcutErrorEnum.RESERVED
				]);
			}
		});

		it('refuses the Quick Actions dialog shortcut', () => {
			expect(checkShortcut(QUICK_ACTIONS_DIALOG_SHORTCUT)?.code).toBe(QuickActionShortcutErrorEnum.RESERVED);
		});

		it('refuses keys a shortcut may not name', () => {
			for (const shortcut of [
				'',
				'shift',
				'tab',
				'enter',
				'space',
				'esc',
				'f1',
				'left',
				'i+shift',
				'shift+tab'
			]) {
				expect([shortcut, checkShortcut(shortcut)?.code]).toEqual([
					shortcut,
					QuickActionShortcutErrorEnum.INVALID
				]);
			}
		});

		it('refuses more than two keys', () => {
			expect(checkShortcut('a+b+c')?.code).toBe(QuickActionShortcutErrorEnum.TOO_MANY_KEYS);
		});
	});

	describe('shortcutsConflict', () => {
		it('flags the same combination', () => {
			expect(shortcutsConflict('i', 'I')).toBe(true);
			expect(shortcutsConflict('shift+i', 'shift+I')).toBe(true);
		});

		it('flags a combination that starts another one with the same modifiers', () => {
			expect(shortcutsConflict('a', 'a+e')).toBe(true);
			expect(shortcutsConflict('a+e', 'a')).toBe(true);
		});

		it('lets different combinations coexist', () => {
			expect(shortcutsConflict('i', 'shift+i')).toBe(false);
			expect(shortcutsConflict('a+e', 'a+i')).toBe(false);
			expect(shortcutsConflict('e', 'a+e')).toBe(false);
			expect(shortcutsConflict('shift+a', 'a+e')).toBe(false);
			expect(shortcutsConflict('', 'i')).toBe(false);
		});
	});

	describe('validateQuickActionShortcut', () => {
		it('accepts each default against all the others', () => {
			for (const [id, shortcut] of Object.entries(DEFAULTS)) {
				expect([id, validateQuickActionShortcut(shortcut, id, DEFAULTS)]).toEqual([id, null]);
			}
		});

		it('names the action that already uses the combination', () => {
			expect(validateQuickActionShortcut('I', 'createTask', DEFAULTS)).toEqual({
				code: QuickActionShortcutErrorEnum.CONFLICT,
				conflictWith: 'createInvoice'
			});
			expect(validateQuickActionShortcut('a', 'createTask', DEFAULTS)).toEqual({
				code: QuickActionShortcutErrorEnum.CONFLICT,
				conflictWith: 'addEmployee'
			});
		});

		it('ignores actions without a shortcut and the action itself', () => {
			expect(validateQuickActionShortcut('t', 'createTask', DEFAULTS)).toBeNull();
			expect(validateQuickActionShortcut('i', 'createTask', { ...DEFAULTS, createInvoice: '' })).toBeNull();
		});

		it('checks the rules before clashes', () => {
			expect(validateQuickActionShortcut('ctrl+i', 'createTask', DEFAULTS)?.code).toBe(
				QuickActionShortcutErrorEnum.RESERVED
			);
		});
	});

	describe('ShortcutRecorder', () => {
		it('records a single key when it is released', () => {
			const recorder = new ShortcutRecorder();
			expect(recorder.keydown(key('y'))).toEqual({ status: 'recording', preview: 'y' });
			expect(recorder.keyup(key('y'))).toEqual({ status: 'recorded', shortcut: 'y' });
		});

		it('records Shift with a key', () => {
			const recorder = new ShortcutRecorder();
			expect(recorder.keydown(key('Shift', { shiftKey: true }))).toEqual({
				status: 'recording',
				preview: 'shift'
			});
			expect(recorder.keydown(key('Y', { shiftKey: true }))).toEqual({ status: 'recording', preview: 'shift+y' });
			expect(recorder.keyup(key('Y', { shiftKey: true }))).toEqual({ status: 'recorded', shortcut: 'shift+y' });
		});

		it('records two keys once both are released', () => {
			const recorder = new ShortcutRecorder();
			recorder.keydown(key('a'));
			expect(recorder.keydown(key('e'))).toEqual({ status: 'recording', preview: 'a+e' });
			expect(recorder.keyup(key('e'))).toEqual({ status: 'recording', preview: 'a+e' });
			expect(recorder.keyup(key('a'))).toEqual({ status: 'recorded', shortcut: 'a+e' });
		});

		it('records reserved modifiers too (validation refuses them later)', () => {
			const recorder = new ShortcutRecorder();
			recorder.keydown(key('Control', { ctrlKey: true }));
			recorder.keydown(key('k', { ctrlKey: true }));
			expect(recorder.keyup(key('k', { ctrlKey: true }))).toEqual({ status: 'recorded', shortcut: 'ctrl+k' });
		});

		it('cancels on Escape and clears on Backspace or Delete, acting on release', () => {
			const cancel = new ShortcutRecorder();
			expect(cancel.keydown(key('Escape')).status).toBe('recording');
			expect(cancel.keyup(key('Escape'))).toEqual({ status: 'cancelled' });

			for (const value of ['Backspace', 'Delete']) {
				const clear = new ShortcutRecorder();
				expect(clear.keydown(key(value)).status).toBe('recording');
				expect(clear.keyup(key(value))).toEqual({ status: 'cleared' });
			}
		});

		it('treats Escape with a modifier as keys, not as a command', () => {
			const recorder = new ShortcutRecorder();
			recorder.keydown(key('Escape', { shiftKey: true }));
			expect(recorder.keyup(key('Escape', { shiftKey: true }))).toEqual({
				status: 'recorded',
				shortcut: 'shift+esc'
			});
		});

		it('lets Tab through', () => {
			expect(new ShortcutRecorder().keydown(key('Tab'))).toEqual({ status: 'released' });
		});

		it('never completes on modifiers alone', () => {
			const recorder = new ShortcutRecorder();
			recorder.keydown(key('Shift', { shiftKey: true }));
			expect(recorder.keyup(key('Shift'))).toEqual({ status: 'recording', preview: '' });
		});

		it('reports the release of a key pressed before recording started as ignored', () => {
			// -- the Enter that pressed the shortcut button: its release belongs to the page, not to the recording
			const recorder = new ShortcutRecorder();
			expect(recorder.keyup(key('Enter'))).toEqual({ status: 'ignored' });
			expect(recorder.keyup(key('Shift'))).toEqual({ status: 'ignored' });
			expect(recorder.keyup(key('Unidentified'))).toEqual({ status: 'ignored' });
			recorder.keydown(key('y'));
			expect(recorder.keyup(key('y'))).toEqual({ status: 'recorded', shortcut: 'y' });
		});

		it('ignores auto-repeat', () => {
			const recorder = new ShortcutRecorder();
			recorder.keydown(key('y'));
			expect(recorder.keydown(key('y', { repeat: true }))).toEqual({ status: 'recording', preview: 'y' });
			expect(recorder.keyup(key('y'))).toEqual({ status: 'recorded', shortcut: 'y' });
		});

		it('keeps the release of a modifier pressed during the recording', () => {
			const recorder = new ShortcutRecorder();
			recorder.keydown(key('Shift', { shiftKey: true }));
			expect(recorder.keyup(key('Shift')).status).toBe('recording');
		});
	});
});
