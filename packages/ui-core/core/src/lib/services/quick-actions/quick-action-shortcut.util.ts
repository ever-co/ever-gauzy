import { QUICK_ACTIONS_DIALOG_SHORTCUT } from './quick-action.definitions';

/**
 * Keyboard-shortcut helpers for the Quick Actions.
 *
 * One canonical spelling for a shortcut — lower case, `+`-separated, the modifiers first in the
 * order ctrl, alt, shift, meta, then the other keys in the order they are pressed: `'shift+i'`,
 * `'a+e'`, `'ctrl+q'`. The header registers and matches shortcuts in that spelling and saved
 * preferences store it. Two readers produce it: {@link keyCodesToShortcut} from what hotkeys-js
 * reports for a key press, and {@link keyboardEventToKeyName} (through {@link ShortcutRecorder})
 * from a `KeyboardEvent` while the user records a new shortcut. Both resolve a key the way
 * hotkeys-js 4 does (`event.key` first, then the `KeyX` code, then the key code), so a recorded
 * shortcut is the string the header later sees for the same keys, whatever the keyboard layout.
 */

export type ShortcutModifier = 'ctrl' | 'alt' | 'shift' | 'meta';

/** Modifiers in their canonical order. */
export const SHORTCUT_MODIFIERS: ReadonlyArray<ShortcutModifier> = ['ctrl', 'alt', 'shift', 'meta'];

/**
 * Modifiers a user shortcut may not use: their combinations belong to the browser and the
 * operating system (new tab, address bar, find, print, devtools, window menus, quit ...).
 */
export const RESERVED_SHORTCUT_MODIFIERS: ReadonlyArray<ShortcutModifier> = ['ctrl', 'alt', 'meta'];

/** Single keys a browser acts on outside text fields (Firefox quick find). */
export const RESERVED_SHORTCUTS: ReadonlyArray<string> = ['/', "'"];

/** Most non-modifier keys a shortcut may combine (`'a+e'` is two). */
export const MAX_SHORTCUT_KEYS = 2;

/** The keys a user shortcut may name besides its modifiers: letters, digits and punctuation. */
const SHORTCUT_KEY_PATTERN = /^(?:[a-z0-9]|[,./`\-=;'[\]\\])$/;

/** Spellings hotkeys-js accepts for a modifier. */
const MODIFIER_ALIASES: Readonly<Record<string, ShortcutModifier>> = {
	ctrl: 'ctrl',
	control: 'ctrl',
	alt: 'alt',
	option: 'alt',
	shift: 'shift',
	meta: 'meta',
	cmd: 'meta',
	command: 'meta'
};

const MODIFIER_KEY_CODES: Readonly<Record<number, ShortcutModifier>> = {
	16: 'shift',
	17: 'ctrl',
	18: 'alt',
	91: 'meta',
	93: 'meta',
	224: 'meta'
};

/**
 * Names of the keys that are neither letters, digits nor modifiers, by key code (both browser
 * variants of `;`, `=` and `-`). F1-F19 are computed.
 */
const NAMED_KEY_CODES: Readonly<Record<number, string>> = {
	8: 'backspace',
	9: 'tab',
	13: 'enter',
	27: 'esc',
	32: 'space',
	33: 'pageup',
	34: 'pagedown',
	35: 'end',
	36: 'home',
	37: 'left',
	38: 'up',
	39: 'right',
	40: 'down',
	45: 'ins',
	46: 'del',
	59: ';',
	61: '=',
	173: '-',
	186: ';',
	187: '=',
	188: ',',
	189: '-',
	190: '.',
	191: '/',
	192: '`',
	219: '[',
	220: '\\',
	221: ']',
	222: "'"
};

/**
 * Names by `KeyboardEvent.key` (lower case): the keys hotkeys-js resolves from `key` before codes
 * (its key map, including its short aliases).
 */
const EVENT_KEY_NAMES: Readonly<Record<string, string>> = {
	backspace: 'backspace',
	tab: 'tab',
	enter: 'enter',
	return: 'enter',
	escape: 'esc',
	esc: 'esc',
	' ': 'space',
	space: 'space',
	pageup: 'pageup',
	pagedown: 'pagedown',
	end: 'end',
	home: 'home',
	arrowleft: 'left',
	arrowup: 'up',
	arrowright: 'right',
	arrowdown: 'down',
	left: 'left',
	up: 'up',
	right: 'right',
	down: 'down',
	insert: 'ins',
	ins: 'ins',
	delete: 'del',
	del: 'del',
	',': ',',
	'.': '.',
	'/': '/',
	'`': '`',
	'-': '-',
	'=': '=',
	';': ';',
	"'": "'",
	'[': '[',
	']': ']',
	'{': '[',
	'}': ']',
	'\\': '\\'
};

const hasOwn = (record: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(record, key);

/** True for `ctrl`, `alt`, `shift` and `meta`. */
export function isShortcutModifier(name: string): name is ShortcutModifier {
	return (SHORTCUT_MODIFIERS as ReadonlyArray<string>).includes(name);
}

/** A shortcut split into its modifiers (canonical order) and its other keys (pressed order). */
export interface IParsedShortcut {
	modifiers: ShortcutModifier[];
	keys: string[];
}

/**
 * Builds the canonical spelling from modifiers and keys: modifiers in canonical order, keys in the
 * given order without duplicates.
 */
export function buildShortcut(modifiers: Iterable<ShortcutModifier>, keys: ReadonlyArray<string>): string {
	const active = new Set(modifiers);
	return [...SHORTCUT_MODIFIERS.filter((modifier) => active.has(modifier)), ...new Set(keys)].join('+');
}

/** The `KeyboardEvent` flag of each modifier. */
const MODIFIER_EVENT_FLAGS: Readonly<Record<ShortcutModifier, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>> = {
	ctrl: 'ctrlKey',
	alt: 'altKey',
	shift: 'shiftKey',
	meta: 'metaKey'
};

/** The modifiers a key event says are held. */
export function heldModifiers(
	event: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>
): ShortcutModifier[] {
	return SHORTCUT_MODIFIERS.filter((modifier) => event[MODIFIER_EVENT_FLAGS[modifier]]);
}

/**
 * Splits a shortcut. Only the modifiers in front count as modifiers (`'i+shift'` is not
 * `'shift+i'`: the header matches keys in the order they go down, and a modifier pressed after a
 * key does not make a combination).
 */
export function parseShortcut(shortcut: string | null | undefined): IParsedShortcut {
	const parts = (typeof shortcut === 'string' ? shortcut : '')
		.toLowerCase()
		.replace(/\s+/g, '')
		.split('+')
		.filter(Boolean);
	let index = 0;
	const modifiers = new Set<ShortcutModifier>();
	while (index < parts.length && hasOwn(MODIFIER_ALIASES, parts[index])) {
		modifiers.add(MODIFIER_ALIASES[parts[index]]);
		index++;
	}
	return {
		modifiers: SHORTCUT_MODIFIERS.filter((modifier) => modifiers.has(modifier)),
		keys: [...new Set(parts.slice(index))]
	};
}

/** The canonical spelling of a shortcut (`'shift+I'` → `'shift+i'`); `''` for none. */
export function normalizeShortcut(shortcut: string | null | undefined): string {
	const { modifiers, keys } = parseShortcut(shortcut);
	return buildShortcut(modifiers, keys);
}

/** Display form, as the Quick Actions badges have always shown it: `'shift+i'` → `'SHIFT + I'`. */
export function formatShortcut(shortcut: string | null | undefined): string {
	const canonical = normalizeShortcut(shortcut);
	return canonical
		? canonical
				.split('+')
				.map((part) => part.toUpperCase())
				.join(' + ')
		: '';
}

/** Canonical name of a key code as hotkeys-js reports it; `null` for a key no shortcut can name. */
export function keyCodeToKeyName(code: number): string | null {
	if (hasOwn(MODIFIER_KEY_CODES, code)) {
		return MODIFIER_KEY_CODES[code];
	}
	if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90)) {
		return String.fromCharCode(code).toLowerCase();
	}
	if (code >= 112 && code <= 130) {
		return `f${code - 111}`;
	}
	return hasOwn(NAMED_KEY_CODES, code) ? NAMED_KEY_CODES[code] : null;
}

/**
 * The canonical shortcut for the keys hotkeys-js reports as held down (`HotkeysEvent.keys`, in the
 * order they went down): `[16, 73]` → `'shift+i'`. The modifiers held before the first other key
 * are put in canonical order, so `ctrl+shift+k` matches whichever modifier went down first. `''`
 * when a key has no name — such a press can never match a shortcut (before, F1 read as `p` and
 * pressing it opened Create Payment).
 */
export function keyCodesToShortcut(codes: ReadonlyArray<number>): string {
	const names: string[] = [];
	for (const code of codes) {
		const name = keyCodeToKeyName(code);
		if (!name) {
			return '';
		}
		names.push(name);
	}
	return normalizeShortcut(names.join('+'));
}

/**
 * Canonical name of the key a `KeyboardEvent` is about, resolved like hotkeys-js 4 resolves it:
 * the `key` value when it names a known key, a digit or a latin letter; else the layout-independent
 * `KeyX` code (a letter on a non-latin layout); else the key code. `null` for a key no shortcut can
 * name.
 */
export function keyboardEventToKeyName(event: Pick<KeyboardEvent, 'key' | 'code' | 'keyCode'>): string | null {
	const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
	if (hasOwn(MODIFIER_ALIASES, key)) {
		return MODIFIER_ALIASES[key];
	}
	if (hasOwn(EVENT_KEY_NAMES, key)) {
		return EVENT_KEY_NAMES[key];
	}
	if (/^(?:[a-z0-9]|f(?:[1-9]|1[0-9]))$/.test(key)) {
		return key;
	}
	const letter = /^Key([A-Z])$/.exec(event.code ?? '');
	if (letter) {
		return letter[1].toLowerCase();
	}
	return typeof event.keyCode === 'number' ? keyCodeToKeyName(event.keyCode) : null;
}

/** Why a shortcut was refused. */
export enum QuickActionShortcutErrorEnum {
	/** No key besides modifiers, or a key a shortcut may not name (Tab, Enter, arrows, F-keys ...). */
	INVALID = 'INVALID',
	/** More than {@link MAX_SHORTCUT_KEYS} keys. */
	TOO_MANY_KEYS = 'TOO_MANY_KEYS',
	/** Reserved by the browser or the operating system, or opens the Quick Actions dialog. */
	RESERVED = 'RESERVED',
	/** Clashes with the shortcut of another action. */
	CONFLICT = 'CONFLICT'
}

export interface IQuickActionShortcutError {
	code: QuickActionShortcutErrorEnum;
	/** For `CONFLICT`: the id of the action that already uses the combination. */
	conflictWith?: string;
}

/**
 * The rules every user shortcut follows on its own (no clash check): one or two letter, digit or
 * punctuation keys, optionally with Shift, and nothing the browser, the operating system or the
 * dialog itself already uses. `null` when the shortcut is acceptable.
 */
export function checkShortcut(shortcut: string | null | undefined): IQuickActionShortcutError | null {
	const { modifiers, keys } = parseShortcut(shortcut);
	if (!keys.length || !keys.every((key) => SHORTCUT_KEY_PATTERN.test(key))) {
		return { code: QuickActionShortcutErrorEnum.INVALID };
	}
	if (keys.length > MAX_SHORTCUT_KEYS) {
		return { code: QuickActionShortcutErrorEnum.TOO_MANY_KEYS };
	}
	const canonical = buildShortcut(modifiers, keys);
	if (
		modifiers.some((modifier) => RESERVED_SHORTCUT_MODIFIERS.includes(modifier)) ||
		RESERVED_SHORTCUTS.includes(canonical) ||
		canonical === normalizeShortcut(QUICK_ACTIONS_DIALOG_SHORTCUT)
	) {
		return { code: QuickActionShortcutErrorEnum.RESERVED };
	}
	return null;
}

/**
 * True when two shortcuts cannot both be bound: the same combination, or one is the start of the
 * other with the same modifiers (`'a'` and `'a+e'`: pressing A would already fire the first).
 */
export function shortcutsConflict(first: string | null | undefined, second: string | null | undefined): boolean {
	const a = parseShortcut(first);
	const b = parseShortcut(second);
	if (!a.keys.length || !b.keys.length || a.modifiers.join('+') !== b.modifiers.join('+')) {
		return false;
	}
	const [shorter, longer] = a.keys.length <= b.keys.length ? [a.keys, b.keys] : [b.keys, a.keys];
	return shorter.every((key, index) => longer[index] === key);
}

/**
 * Validates a shortcut the user recorded for `actionId` against the rules ({@link checkShortcut})
 * and against the shortcuts of every other action (`bindings`: action id → shortcut, `''` for none).
 * `null` when it can be used.
 */
export function validateQuickActionShortcut(
	shortcut: string,
	actionId: string,
	bindings: Readonly<Record<string, string>>
): IQuickActionShortcutError | null {
	const error = checkShortcut(shortcut);
	if (error) {
		return error;
	}
	for (const [id, other] of Object.entries(bindings)) {
		if (id !== actionId && shortcutsConflict(shortcut, other)) {
			return { code: QuickActionShortcutErrorEnum.CONFLICT, conflictWith: id };
		}
	}
	return null;
}

/** The parts of a `KeyboardEvent` the recorder reads. */
export type ShortcutRecorderEvent = Pick<
	KeyboardEvent,
	'key' | 'code' | 'keyCode' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'
> & { repeat?: boolean };

/** What a key event means for a recording. */
export type ShortcutRecorderResult =
	/** Still recording; `preview` is what is held so far (canonical spelling, may be only modifiers). */
	| { status: 'recording'; preview: string }
	/** Every key was released: `shortcut` is the recorded combination (not validated yet). */
	| { status: 'recorded'; shortcut: string }
	/** Backspace or Delete on its own: remove the shortcut. */
	| { status: 'cleared' }
	/** Escape on its own: keep the current shortcut. */
	| { status: 'cancelled' }
	/** Tab: stop recording and let the browser move the focus (the keyboard is never trapped). */
	| { status: 'released' };

/**
 * Records one shortcut from key events ("click the shortcut, then press the new keys").
 *
 * Keys are collected while they go down and the combination is complete when the last one is
 * released, so two-key shortcuts such as `A+E` can be recorded. Escape, Backspace and Delete pressed
 * on their own are commands, acted on when released (so the matching key-up never reaches a dialog
 * that closes on Escape). One recorder per recording.
 */
export class ShortcutRecorder {
	private readonly keys: string[] = [];
	private readonly held = new Set<string>();
	private readonly modifiers = new Set<ShortcutModifier>();
	private command: { status: 'cleared' | 'cancelled'; key: string } | null = null;

	keydown(event: ShortcutRecorderEvent): ShortcutRecorderResult {
		const name = keyboardEventToKeyName(event);
		if (name === 'tab') {
			return { status: 'released' };
		}
		if (!name || event.repeat || isShortcutModifier(name)) {
			return this.recording(event);
		}
		const modifiers = heldModifiers(event);
		const alone = !this.keys.length && !modifiers.length;
		if (alone && name === 'esc') {
			this.command = { status: 'cancelled', key: name };
			return this.recording(event);
		}
		if (alone && (name === 'backspace' || name === 'del')) {
			this.command = { status: 'cleared', key: name };
			return this.recording(event);
		}
		this.command = null;
		modifiers.forEach((modifier) => this.modifiers.add(modifier));
		if (!this.keys.includes(name)) {
			this.keys.push(name);
		}
		this.held.add(name);
		return this.recording(event);
	}

	keyup(event: ShortcutRecorderEvent): ShortcutRecorderResult {
		const name = keyboardEventToKeyName(event);
		if (this.command && name === this.command.key) {
			return { status: this.command.status };
		}
		if (name && this.held.delete(name) && this.held.size === 0 && this.keys.length) {
			return { status: 'recorded', shortcut: buildShortcut(this.modifiers, this.keys) };
		}
		return this.recording(event);
	}

	private recording(event: ShortcutRecorderEvent): ShortcutRecorderResult {
		return { status: 'recording', preview: buildShortcut([...this.modifiers, ...heldModifiers(event)], this.keys) };
	}
}
