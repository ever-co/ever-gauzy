// cspell:ignore arrowdown arrowup arrowleft arrowright
/**
 * The app's shortcut registry: every command with its context, its default binding and the key names the help and
 * the settings page show. Pure: no Angular, no DOM listener.
 *
 * Bindings use the syntax Ever Teams uses, so a rebinding made in one client follows the person to the other (both
 * store it in `uiPreferences.keyboard.bindings`, keyed by command id): keys separated by `+` for a chord (`mod+s`,
 * `shift+d`), chords separated by a space for a sequence (`g t`). `mod` is ⌘ on a Mac and Ctrl elsewhere. Letters
 * and digits match the physical key (`event.code`), so `J` works on a layout where that key prints something else;
 * punctuation is the character typed (`?`, not `shift+/`), since the key that prints it differs by layout.
 *
 * Command ids are plain words: they are also the i18n keys under `TASK_VIEWS.SHORTCUTS.COMMANDS`.
 */

/** Where a command applies: everywhere, on the list of the views page, or on its selected (or focused) tasks. */
export type ShortcutContext = 'global' | 'list' | 'task';

export interface ShortcutCommand {
	id: string;
	context: ShortcutContext;
	/** The binding when the person has not changed it. */
	defaultBinding: string;
	/** A command the person cannot rebind (Enter and Esc of the list). */
	fixed?: boolean;
	/**
	 * A key of the list (`J`, `X`, `S`, …): one chord without ⌘/Ctrl, never a sequence. The chord with Shift added
	 * is the command's too: the row-moving commands extend the selection with it, `X` selects a range.
	 */
	chordOnly?: boolean;
}

export interface ShortcutChord {
	key: string;
	mod: boolean;
	shift: boolean;
	alt: boolean;
}

/** A parsed binding: one chord, or a sequence of chords. */
export type ShortcutBinding = ShortcutChord[];

/** The commands, in the order the help and the settings page list them (ids shared with Ever Teams where it has them). */
export const SHORTCUT_COMMANDS: readonly ShortcutCommand[] = [
	// global
	{ id: 'helpOpen', context: 'global', defaultBinding: '?' },
	{ id: 'taskGoTo', context: 'global', defaultBinding: 'g r' },
	{ id: 'goTasks', context: 'global', defaultBinding: 'g t' },
	{ id: 'goViews', context: 'global', defaultBinding: 'g v' },
	{ id: 'goMine', context: 'global', defaultBinding: 'g m' },
	{ id: 'goThisWeek', context: 'global', defaultBinding: 'g w' },
	{ id: 'goOverdue', context: 'global', defaultBinding: 'g o' },
	{ id: 'goInbox', context: 'global', defaultBinding: 'g i' },
	{ id: 'goChat', context: 'global', defaultBinding: 'g c' },
	{ id: 'goDocs', context: 'global', defaultBinding: 'g d' },
	{ id: 'goHome', context: 'global', defaultBinding: 'g h' },
	{ id: 'goProjects', context: 'global', defaultBinding: 'g p' },
	{ id: 'goTimesheets', context: 'global', defaultBinding: 'g s' },
	{ id: 'settingsOpen', context: 'global', defaultBinding: 'mod+,' },
	// the list of the views page
	{ id: 'listDown', context: 'list', defaultBinding: 'j', chordOnly: true },
	{ id: 'listUp', context: 'list', defaultBinding: 'k', chordOnly: true },
	{ id: 'listSelect', context: 'list', defaultBinding: 'x', chordOnly: true },
	{ id: 'listOpen', context: 'list', defaultBinding: 'enter', fixed: true },
	{ id: 'listClear', context: 'list', defaultBinding: 'escape', fixed: true },
	{ id: 'listSaveView', context: 'list', defaultBinding: 'mod+s' },
	// the selected tasks (or the focused one): the bulk toolbar's pickers
	{ id: 'taskStatus', context: 'task', defaultBinding: 's', chordOnly: true },
	{ id: 'taskPriority', context: 'task', defaultBinding: 'p', chordOnly: true },
	{ id: 'taskLabels', context: 'task', defaultBinding: 'l', chordOnly: true },
	{ id: 'taskDueDate', context: 'task', defaultBinding: 'd', chordOnly: true }
];

/** The contexts in the order the help lists them. */
export const SHORTCUT_CONTEXTS: readonly ShortcutContext[] = ['global', 'list', 'task'];

/** The commands that still run while a dialog is open: the help toggles itself. */
export const DIALOG_SAFE_COMMANDS: ReadonlySet<string> = new Set(['helpOpen']);

/** The contexts whose keys reach the same person at once: a selected task is a row of the list. */
const OVERLAPPING_CONTEXTS: ReadonlySet<ShortcutContext> = new Set(['list', 'task']);

const MODIFIER_NAMES = new Set(['mod', 'ctrl', 'cmd', 'meta', 'shift', 'alt', 'option', 'control', 'os']);

/** Key combinations the browser keeps for itself: a binding on one of them is refused. */
const BROWSER_RESERVED = new Set([
	'mod+w',
	'mod+t',
	'mod+n',
	'mod+q',
	'mod+r',
	'mod+l',
	'mod+shift+t',
	'mod+shift+n',
	'mod+shift+w',
	'f5',
	'f11',
	'f12'
]);

/** The keys the list keeps whatever the bindings, by the command they run: the arrows, Enter and O, Esc. */
const LIST_BUILT_IN_KEYS: ReadonlyMap<string, string> = new Map([
	['arrowdown', 'listDown'],
	['arrowup', 'listUp'],
	['enter', 'listOpen'],
	['o', 'listOpen'],
	['escape', 'listClear']
]);

/** The key `+` is written `plus` in a binding, since `+` separates the keys of a chord. */
const PLUS_KEY_NAME = 'plus';

/** One chord of a binding (`mod+shift+d`), or null when it is not one. */
export function parseChord(text: string): ShortcutChord | null {
	const parts = text.trim().toLowerCase().split('+').filter(Boolean);
	if (!parts.length) return null;
	const chord: ShortcutChord = { key: '', mod: false, shift: false, alt: false };
	for (const part of parts) {
		if (part === 'mod' || part === 'ctrl' || part === 'cmd' || part === 'meta' || part === 'control')
			chord.mod = true;
		else if (part === 'shift') chord.shift = true;
		else if (part === 'alt' || part === 'option') chord.alt = true;
		else if (chord.key) return null;
		else chord.key = part === PLUS_KEY_NAME ? '+' : part;
	}
	return chord.key ? chord : null;
}

/** A binding (`g t`, `mod+s`), or null when any chord is malformed. */
export function parseBinding(text: string | null | undefined): ShortcutBinding | null {
	const chords = String(text ?? '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map(parseChord);
	if (!chords.length || chords.includes(null)) return null;
	return chords as ShortcutChord[];
}

/** The canonical text of a binding (`mod+shift+d`, `g t`): what is stored and compared. */
export function formatBinding(binding: ShortcutBinding): string {
	return binding
		.map((chord) =>
			[
				chord.mod ? 'mod' : '',
				chord.shift ? 'shift' : '',
				chord.alt ? 'alt' : '',
				chord.key === '+' ? PLUS_KEY_NAME : chord.key
			]
				.filter(Boolean)
				.join('+')
		)
		.join(' ');
}

const KEY_LABELS: Record<string, string> = {
	enter: 'Enter',
	escape: 'Esc',
	backspace: '⌫',
	delete: 'Del',
	arrowup: '↑',
	arrowdown: '↓',
	arrowleft: '←',
	arrowright: '→',
	space: 'Space',
	tab: 'Tab'
};

/** The key caps of a binding as the help shows them: one list per chord (`['⌘', 'S']`), chords in order. */
export function bindingKeyCaps(binding: ShortcutBinding | null | undefined, isMac: boolean): string[][] {
	return (binding ?? []).map((chord) => {
		const caps: string[] = [];
		if (chord.mod) caps.push(isMac ? '⌘' : 'Ctrl');
		if (chord.alt) caps.push(isMac ? '⌥' : 'Alt');
		if (chord.shift) caps.push(isMac ? '⇧' : 'Shift');
		caps.push(KEY_LABELS[chord.key] ?? chord.key.toUpperCase());
		return caps;
	});
}

/** Whether a key name is a character typed with (or without) Shift, whose own identity carries the Shift. */
function isPrintablePunctuation(key: string): boolean {
	return key.length === 1 && !/[a-z\d]/.test(key);
}

/**
 * The key of a key press as a binding names it: letters and digits by their physical key, the rest by `key`. A
 * digit key pressed with Shift that types punctuation is that character (`/` is Shift+7 on a German layout).
 */
export function chordKeyOf(event: Pick<KeyboardEvent, 'key' | 'code'> & { shiftKey?: boolean }): string {
	const code = event.code ?? '';
	if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
	const typed = event.key ?? '';
	if (/^Digit\d$/.test(code)) return event.shiftKey && isPrintablePunctuation(typed) ? typed : code.slice(5);
	const key = typed.toLowerCase();
	if (key === ' ') return 'space';
	if (key === 'esc') return 'escape';
	return key;
}

/** The chord a key press is, or null for a modifier alone. Punctuation carries its own Shift (`?` is one key). */
export function chordOfEvent(
	event: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
	platform?: 'mac' | 'other'
): ShortcutChord | null {
	const key = chordKeyOf(event);
	if (!key || MODIFIER_NAMES.has(key) || key === 'dead' || key === 'unidentified' || key === 'process') return null;
	const shift = isPrintablePunctuation(key) ? false : !!event.shiftKey;
	// `mod` is the platform's command key: ⌘ on a Mac, Ctrl elsewhere. The other one (Control on a Mac, the Windows
	// key elsewhere) is in no binding, so a chord holding it is no chord of the app's (Control+S on a Mac is not ⌘S).
	if (platform === 'mac' && event.ctrlKey) return null;
	if (platform === 'other' && event.metaKey) return null;
	const mod =
		platform === 'mac'
			? !!event.metaKey
			: platform === 'other'
				? !!event.ctrlKey
				: !!(event.metaKey || event.ctrlKey);
	return { key, mod, shift, alt: !!event.altKey };
}

/** Whether two chords are the same keys. */
export function sameChord(first: ShortcutChord, second: ShortcutChord): boolean {
	return (
		first.key === second.key && first.mod === second.mod && first.shift === second.shift && first.alt === second.alt
	);
}

/** Whether a binding has a chord the browser keeps (`mod+w`, or `mod+w t`: the sequence could never be finished). */
export function isBrowserReserved(binding: ShortcutBinding): boolean {
	return binding.some((chord) => BROWSER_RESERVED.has(formatBinding([chord])));
}

function isListBuiltInKey(chord: ShortcutChord): boolean {
	return !chord.mod && !chord.alt && LIST_BUILT_IN_KEYS.has(chord.key);
}

/** Why a binding cannot be given to a command. */
export type ShortcutRefusal = 'reserved' | 'sequence' | 'modifier' | 'listKey';

/**
 * Why a binding cannot be given to a command, or null when it can: one the browser keeps (`reserved`); for a key the
 * list matches on a row, a sequence (`sequence`) or ⌘/Ctrl (`modifier`: the browser's own chords, copy and select
 * all, would run as well); or one starting with a key the list keeps for itself (`listKey`: ↑, ↓, Enter, O, Esc).
 */
export function refusalOf(command: ShortcutCommand, binding: ShortcutBinding): ShortcutRefusal | null {
	if (isBrowserReserved(binding)) return 'reserved';
	if (command.chordOnly && binding.length > 1) return 'sequence';
	if (command.chordOnly && binding.some((chord) => chord.mod)) return 'modifier';
	if (binding.length > 0 && isListBuiltInKey(binding[0])) return 'listKey';
	return null;
}

/** Whether one binding starts with the other (equal bindings included): the shorter would fire before the longer could. */
export function overlaps(first: ShortcutBinding, second: ShortcutBinding): boolean {
	const length = Math.min(first.length, second.length);
	for (let at = 0; at < length; at += 1) {
		if (!sameChord(first[at], second[at])) return false;
	}
	return true;
}

/** The bindings a command holds: its own, and for a row key without Shift, the same chord with Shift. */
function heldBindingsOf(command: ShortcutCommand, binding: ShortcutBinding): ShortcutBinding[] {
	const [chord] = binding;
	if (!command.chordOnly || binding.length !== 1 || chord.shift) return [binding];
	return [binding, [{ ...chord, shift: true }]];
}

/**
 * The commands whose binding would clash with the given one in the same (or the global) context, the list and its
 * tasks counting as one: the same keys, or one binding the start of the other (`Shift+J` counting as a row key bound
 * to `J`). The command itself is left out.
 */
export function conflictsOf(
	commandId: string,
	binding: ShortcutBinding,
	commands: readonly ShortcutCommand[],
	bindings: ReadonlyMap<string, ShortcutBinding | null>
): ShortcutCommand[] {
	const command = commands.find((item) => item.id === commandId);
	if (!command) return [];
	return commands.filter((other) => {
		if (other.id === commandId) return false;
		const otherBinding = bindings.get(other.id);
		if (!otherBinding) return false;
		const sharesContext =
			other.context === command.context ||
			other.context === 'global' ||
			command.context === 'global' ||
			(OVERLAPPING_CONTEXTS.has(other.context) && OVERLAPPING_CONTEXTS.has(command.context));
		if (!sharesContext) return false;
		const theirs = heldBindingsOf(other, otherBinding);
		return heldBindingsOf(command, binding).some((mine) => theirs.some((held) => overlaps(mine, held)));
	});
}

/**
 * The bindings in force: the defaults with the person's overrides on top (an empty override removes the default).
 * An override this client would not have saved — stored by another client or by hand — leaves the default in force:
 * one it refuses, and one that clashes with another binding in force. Clashes are settled in registry order: the
 * first override found in conflict goes back to its default, then the check runs again, until none clashes; a swap
 * (J and K exchanged) clashes with nothing and stays.
 */
export function effectiveBindings(
	commands: readonly ShortcutCommand[],
	overrides: Readonly<Record<string, string>> | null | undefined
): Map<string, ShortcutBinding | null> {
	const result = new Map<string, ShortcutBinding | null>();
	const overridden: ShortcutCommand[] = [];
	for (const command of commands) {
		const override = overrides?.[command.id];
		const defaultBinding = parseBinding(command.defaultBinding);
		if (command.fixed || typeof override !== 'string') {
			result.set(command.id, defaultBinding);
			continue;
		}
		if (override === '') {
			result.set(command.id, null);
			continue;
		}
		const parsed = parseBinding(override);
		if (!parsed || refusalOf(command, parsed) !== null) {
			result.set(command.id, defaultBinding);
			continue;
		}
		result.set(command.id, parsed);
		overridden.push(command);
	}
	const reverted = new Set<string>();
	let isSettled = false;
	while (!isSettled) {
		isSettled = true;
		for (const command of overridden) {
			if (reverted.has(command.id)) continue;
			if (!conflictsOf(command.id, result.get(command.id) as ShortcutBinding, commands, result).length) continue;
			result.set(command.id, parseBinding(command.defaultBinding));
			reverted.add(command.id);
			isSettled = false;
			break;
		}
	}
	return result;
}

/**
 * The overrides with one command's binding changed: `null` removes the command's key (stored as an empty string),
 * `'default'` puts the default back (the override goes). Overrides of commands this client does not know (another
 * client's) are kept as they are.
 */
export function withOverride(
	overrides: Readonly<Record<string, string>> | null | undefined,
	command: Pick<ShortcutCommand, 'id' | 'defaultBinding'>,
	binding: ShortcutBinding | null | 'default'
): Record<string, string> {
	const next: Record<string, string> = { ...(overrides ?? {}) };
	if (binding === 'default') {
		delete next[command.id];
		return next;
	}
	if (binding === null) {
		next[command.id] = '';
		return next;
	}
	const text = formatBinding(binding);
	if (text === formatBinding(parseBinding(command.defaultBinding) ?? [])) delete next[command.id];
	else next[command.id] = text;
	return next;
}

/** The overrides as stored, kept only as far as they are strings keyed by a command id. */
export function overridesOf(value: unknown): Record<string, string> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const result: Record<string, string> = {};
	for (const [key, binding] of Object.entries(value as Record<string, unknown>)) {
		if (typeof binding === 'string' && key.length <= 64) result[key] = binding;
	}
	return result;
}

/** A match of a key press: the command, and whether Shift was pressed beyond the binding (extend the selection). */
export interface ShortcutMatch {
	command: ShortcutCommand;
	extend: boolean;
}

/**
 * Walks the chords pressed so far against the bindings in force of the commands that can run now: answers the
 * command matched, or whether more chords could still match (the caller keeps the pending chords). For a row key,
 * the chord with Shift added matches too (`extend`), and the list's own keys (↑, ↓, Enter, O, Esc) match the list
 * commands whatever their bindings.
 */
export function matchKeys(
	pressed: readonly ShortcutChord[],
	commands: readonly ShortcutCommand[],
	bindings: ReadonlyMap<string, ShortcutBinding | null>
): { match: ShortcutMatch | null; pending: boolean } {
	if (!pressed.length) return { match: null, pending: false };
	if (pressed.length === 1 && isListBuiltInKey(pressed[0])) {
		const builtIn = commands.find((command) => command.id === LIST_BUILT_IN_KEYS.get(pressed[0].key));
		if (builtIn) return { match: { command: builtIn, extend: pressed[0].shift }, pending: false };
	}
	let pending = false;
	for (const command of commands) {
		const binding = bindings.get(command.id);
		if (!binding || binding.length < pressed.length) continue;
		if (!pressed.every((chord, at) => sameChord(chord, binding[at]))) continue;
		if (binding.length === pressed.length) return { match: { command, extend: false }, pending: false };
		pending = true;
	}
	if (!pending && pressed.length === 1 && pressed[0].shift) {
		const plain = { ...pressed[0], shift: false };
		const command = commands.find((item) => {
			const binding = bindings.get(item.id);
			return item.chordOnly && binding?.length === 1 && sameChord(binding[0], plain);
		});
		if (command) return { match: { command, extend: true }, pending: false };
	}
	return { match: null, pending };
}

/** The chord in the syntax of the header's Quick Actions keys (hotkeys-js: `shift+g`), for the fallback. */
export function hotkeysShortcutOf(chord: ShortcutChord): string {
	return [chord.mod ? 'ctrl' : '', chord.alt ? 'alt' : '', chord.shift ? 'shift' : '', chord.key]
		.filter(Boolean)
		.join('+');
}

/** Whether a modal dialog is open on the page: its form has the keys then, not the app's commands. */
export function isDialogOpen(doc: Pick<Document, 'querySelectorAll'> | null | undefined): boolean {
	if (!doc) return false;
	for (const element of Array.from(
		doc.querySelectorAll('nb-dialog-container, [role="dialog"], [aria-modal="true"]')
	)) {
		const dialog = element as HTMLElement;
		if (dialog.hidden || dialog.getAttribute('aria-hidden') === 'true') continue;
		if (typeof dialog.getClientRects !== 'function' || dialog.getClientRects().length > 0) return true;
	}
	return false;
}

/** The inputs nothing is typed into: a key pressed on one (a row's checkbox just clicked) is a command. */
const NON_TEXT_INPUTS: ReadonlySet<string> = new Set([
	'checkbox',
	'radio',
	'button',
	'submit',
	'reset',
	'range',
	'color',
	'file',
	'image'
]);

/** Whether the key press happened where text is typed (a field, a select, a rich editor), not commands. */
export function isTypingTarget(target: EventTarget | null): boolean {
	const element = target as HTMLElement | null;
	if (!element || typeof element.tagName !== 'string') return false;
	const tag = element.tagName.toUpperCase();
	if (tag === 'INPUT') return !NON_TEXT_INPUTS.has(String((element as HTMLInputElement).type ?? '').toLowerCase());
	if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'NB-OPTION') return true;
	if (element.isContentEditable === true) return true;
	const editable = element.getAttribute?.('contenteditable');
	if (editable === '' || editable === 'true' || editable === 'plaintext-only') return true;
	// A rich editor marks an ancestor (ProseMirror, CodeMirror, ckeditor): keys typed inside it are text.
	return (
		typeof element.closest === 'function' &&
		!!element.closest('[contenteditable="true"], .ProseMirror, .cm-editor, .ck-editor')
	);
}

/** Whether a chord is Enter or Space alone: what activates a focused control. */
export function isActivationKey(chord: ShortcutChord): boolean {
	return (chord.key === 'enter' || chord.key === 'space') && !chord.mod && !chord.alt;
}

/**
 * Whether the key press is on a control the key activates: a button, a link, a select, for Enter and Space; a check
 * box or a radio for Space only (Enter does nothing on them, so the list's Enter still opens the row).
 */
export function isControlTarget(target: EventTarget | null, key: 'enter' | 'space' | string = 'enter'): boolean {
	const element = target as HTMLElement | null;
	if (!element || typeof element.tagName !== 'string') return false;
	const tag = element.tagName.toUpperCase();
	if (tag === 'BUTTON' || tag === 'A' || tag === 'SELECT' || tag === 'SUMMARY' || tag === 'NB-SELECT') return true;
	if (tag === 'INPUT') {
		const type = String((element as HTMLInputElement).type ?? '').toLowerCase();
		if (type === 'checkbox' || type === 'radio') return key === 'space';
		return NON_TEXT_INPUTS.has(type);
	}
	const role = element.getAttribute?.('role');
	return (
		role === 'button' ||
		role === 'link' ||
		role === 'checkbox' ||
		role === 'menuitem' ||
		role === 'option' ||
		role === 'tab'
	);
}

/** Whether the person is on a Mac (⌘ is `mod` there). */
export function isMacPlatform(nav: Pick<Navigator, 'platform' | 'userAgent'> | null | undefined): boolean {
	const platform = `${nav?.platform ?? ''} ${nav?.userAgent ?? ''}`;
	return /Mac|iPhone|iPad|iPod/i.test(platform);
}
