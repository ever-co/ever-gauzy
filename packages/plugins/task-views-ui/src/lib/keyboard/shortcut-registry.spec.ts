// cspell:ignore arrowdown arrowup arrowleft arrowright
import {
	bindingKeyCaps,
	chordOfEvent,
	conflictsOf,
	effectiveBindings,
	formatBinding,
	hotkeysShortcutOf,
	isActivationKey,
	isControlTarget,
	isBrowserReserved,
	isDialogOpen,
	isTypingTarget,
	matchKeys,
	overridesOf,
	parseBinding,
	refusalOf,
	SHORTCUT_COMMANDS,
	ShortcutCommand,
	withOverride
} from './shortcut-registry';

const key = (code: string, key: string, extra: Partial<KeyboardEvent> = {}) =>
	({ code, key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra }) as KeyboardEvent;
const command = (id: string) => SHORTCUT_COMMANDS.find((item) => item.id === id) as ShortcutCommand;
const defaults = () => effectiveBindings(SHORTCUT_COMMANDS, {});

describe('shortcut registry', () => {
	describe('the syntax (shared with Ever Teams)', () => {
		it('parses and formats chords and sequences canonically', () => {
			expect(formatBinding(parseBinding('Ctrl+Shift+D')!)).toBe('mod+shift+d');
			expect(formatBinding(parseBinding('  g   t ')!)).toBe('g t');
			expect(formatBinding(parseBinding('mod+plus')!)).toBe('mod+plus');
			expect(parseBinding('mod+a+b')).toBeNull();
			expect(parseBinding('')).toBeNull();
			expect(parseBinding('shift')).toBeNull();
		});

		it('draws key caps for a Mac and for the rest', () => {
			expect(bindingKeyCaps(parseBinding('mod+s'), true)).toEqual([['⌘', 'S']]);
			expect(bindingKeyCaps(parseBinding('g t'), false)).toEqual([['G'], ['T']]);
			expect(bindingKeyCaps(parseBinding('shift+arrowdown'), false)).toEqual([['Shift', '↓']]);
		});

		it('reads letters by their physical key and punctuation by the character typed', () => {
			// A layout where the J key prints something else still answers J.
			expect(chordOfEvent(key('KeyJ', 'о'))).toEqual({ key: 'j', mod: false, shift: false, alt: false });
			expect(chordOfEvent(key('Slash', '?', { shiftKey: true }))).toEqual({
				key: '?',
				mod: false,
				shift: false,
				alt: false
			});
			// `/` is Shift+7 on a German layout.
			expect(chordOfEvent(key('Digit7', '/', { shiftKey: true }))?.key).toBe('/');
			expect(chordOfEvent(key('KeyS', 's', { ctrlKey: true }))).toEqual({
				key: 's',
				mod: true,
				shift: false,
				alt: false
			});
			expect(chordOfEvent(key('ShiftLeft', 'Shift', { shiftKey: true }))).toBeNull();
		});

		it('reads mod as the platform command key: ⌘ on a Mac, Ctrl elsewhere, and nothing with the other one', () => {
			expect(chordOfEvent(key('KeyS', 's', { metaKey: true }), 'mac')?.mod).toBe(true);
			expect(chordOfEvent(key('KeyS', 's', { ctrlKey: true }), 'mac')).toBeNull();
			expect(chordOfEvent(key('KeyS', 's', { ctrlKey: true }), 'other')?.mod).toBe(true);
			expect(chordOfEvent(key('KeyS', 's', { metaKey: true }), 'other')).toBeNull();
		});

		it('writes a chord the way the header Quick Actions name keys', () => {
			expect(hotkeysShortcutOf({ key: 'g', mod: false, shift: false, alt: false })).toBe('g');
			expect(hotkeysShortcutOf({ key: 'g', mod: true, shift: true, alt: false })).toBe('ctrl+shift+g');
		});
	});

	describe('the defaults', () => {
		it('never clash with one another', () => {
			const bindings = defaults();
			for (const item of SHORTCUT_COMMANDS) {
				expect({
					id: item.id,
					conflicts: conflictsOf(item.id, bindings.get(item.id)!, SHORTCUT_COMMANDS, bindings).map(
						(other) => other.id
					)
				}).toEqual({ id: item.id, conflicts: [] });
				expect(refusalOf(item, bindings.get(item.id)!)).toBe(item.fixed ? 'listKey' : null);
			}
		});

		it('use the Ever Teams command ids for the commands both clients have', () => {
			const ids = SHORTCUT_COMMANDS.map((item) => item.id);
			expect(ids).toEqual(
				expect.arrayContaining([
					'helpOpen',
					'goTasks',
					'goInbox',
					'goChat',
					'goDocs',
					'listDown',
					'listUp',
					'listSelect',
					'listOpen',
					'listSaveView',
					'taskStatus'
				])
			);
			expect(formatBinding(defaults().get('goTasks')!)).toBe('g t');
		});
	});

	describe('refusals and conflicts', () => {
		it('refuses browser keys, sequences and Ctrl on row keys, and the keys the list keeps', () => {
			expect(isBrowserReserved(parseBinding('mod+w')!)).toBe(true);
			expect(refusalOf(command('goTasks'), parseBinding('mod+t')!)).toBe('reserved');
			expect(refusalOf(command('listDown'), parseBinding('g j')!)).toBe('sequence');
			expect(refusalOf(command('listDown'), parseBinding('mod+j')!)).toBe('modifier');
			expect(refusalOf(command('goTasks'), parseBinding('enter')!)).toBe('listKey');
			expect(refusalOf(command('goTasks'), parseBinding('g x')!)).toBeNull();
		});

		it('counts a binding that starts another as a clash, and Shift with a row key as the row key', () => {
			const bindings = defaults();
			expect(
				conflictsOf('taskGoTo', parseBinding('g')!, SHORTCUT_COMMANDS, bindings).map((item) => item.id)
			).toEqual(expect.arrayContaining(['goTasks', 'goViews']));
			expect(
				conflictsOf('listSaveView', parseBinding('shift+j')!, SHORTCUT_COMMANDS, bindings).map(
					(item) => item.id
				)
			).toEqual(['listDown']);
			// The list and the selected tasks are one context: S for the next row clashes with S for the status.
			expect(
				conflictsOf('listDown', parseBinding('s')!, SHORTCUT_COMMANDS, bindings).map((item) => item.id)
			).toEqual(['taskStatus']);
		});
	});

	describe('overrides', () => {
		it('applies an override, removes a key with an empty one, and ignores fixed commands', () => {
			const bindings = effectiveBindings(SHORTCUT_COMMANDS, { goTasks: 'g x', helpOpen: '', listOpen: 'o' });
			expect(formatBinding(bindings.get('goTasks')!)).toBe('g x');
			expect(bindings.get('helpOpen')).toBeNull();
			expect(formatBinding(bindings.get('listOpen')!)).toBe('enter');
		});

		it('keeps the default for an override it would refuse or that clashes, and keeps a swap', () => {
			const refused = effectiveBindings(SHORTCUT_COMMANDS, { goTasks: 'mod+w', listDown: 'g j' });
			expect(formatBinding(refused.get('goTasks')!)).toBe('g t');
			expect(formatBinding(refused.get('listDown')!)).toBe('j');
			const clash = effectiveBindings(SHORTCUT_COMMANDS, { goViews: 'g t' });
			expect(formatBinding(clash.get('goViews')!)).toBe('g v');
			const swap = effectiveBindings(SHORTCUT_COMMANDS, { listDown: 'k', listUp: 'j' });
			expect(formatBinding(swap.get('listDown')!)).toBe('k');
			expect(formatBinding(swap.get('listUp')!)).toBe('j');
		});

		it('writes an override, a removal and the default back, keeping other clients commands', () => {
			const stored = { paletteOpen: 'mod+p', goTasks: 'g x' };
			expect(withOverride(stored, command('goTasks'), parseBinding('g y'))).toEqual({
				paletteOpen: 'mod+p',
				goTasks: 'g y'
			});
			expect(withOverride(stored, command('goTasks'), parseBinding('g t'))).toEqual({ paletteOpen: 'mod+p' });
			expect(withOverride(stored, command('goTasks'), null)).toEqual({ paletteOpen: 'mod+p', goTasks: '' });
			expect(withOverride(stored, command('goTasks'), 'default')).toEqual({ paletteOpen: 'mod+p' });
		});

		it('reads only string overrides from what is stored', () => {
			expect(overridesOf({ goTasks: 'g x', bad: 3, nested: {} })).toEqual({ goTasks: 'g x' });
			expect(overridesOf(['g t'])).toEqual({});
			expect(overridesOf(null)).toEqual({});
		});
	});

	describe('matching key presses', () => {
		const chord = (text: string) => parseBinding(text)![0];

		it('walks a sequence: pending after the first key, the command after the second', () => {
			const bindings = defaults();
			expect(matchKeys([chord('g')], SHORTCUT_COMMANDS, bindings)).toEqual({ match: null, pending: true });
			expect(matchKeys([chord('g'), chord('t')], SHORTCUT_COMMANDS, bindings).match?.command.id).toBe('goTasks');
			expect(matchKeys([chord('g'), chord('z')], SHORTCUT_COMMANDS, bindings)).toEqual({
				match: null,
				pending: false
			});
		});

		it('matches only the commands it is given (the runnable ones)', () => {
			const bindings = defaults();
			const onlyGlobal = SHORTCUT_COMMANDS.filter((item) => item.context === 'global');
			expect(matchKeys([chord('j')], onlyGlobal, bindings).match).toBeNull();
			expect(matchKeys([chord('j')], SHORTCUT_COMMANDS, bindings).match?.command.id).toBe('listDown');
		});

		it('takes Shift with a row key as that key extending, and the list keys whatever the bindings', () => {
			const bindings = effectiveBindings(SHORTCUT_COMMANDS, { listDown: 'n' });
			expect(matchKeys([chord('shift+n')], SHORTCUT_COMMANDS, bindings).match).toMatchObject({
				command: { id: 'listDown' },
				extend: true
			});
			expect(matchKeys([chord('shift+x')], SHORTCUT_COMMANDS, bindings).match).toMatchObject({
				command: { id: 'listSelect' },
				extend: true
			});
			expect(matchKeys([chord('arrowdown')], SHORTCUT_COMMANDS, bindings).match?.command.id).toBe('listDown');
			expect(matchKeys([chord('o')], SHORTCUT_COMMANDS, bindings).match?.command.id).toBe('listOpen');
			expect(matchKeys([chord('?')], SHORTCUT_COMMANDS, bindings).match?.command.id).toBe('helpOpen');
		});
	});

	describe('where keys are left alone', () => {
		it('knows fields and editors', () => {
			const input = document.createElement('input');
			const editor = document.createElement('div');
			editor.setAttribute('contenteditable', 'true');
			const inside = document.createElement('span');
			const prose = document.createElement('div');
			prose.className = 'ProseMirror';
			prose.appendChild(inside);
			expect(isTypingTarget(input)).toBe(true);
			expect(isTypingTarget(editor)).toBe(true);
			expect(isTypingTarget(inside)).toBe(true);
			expect(isTypingTarget(document.createElement('button'))).toBe(false);
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			expect(isTypingTarget(checkbox)).toBe(false);
			const search = document.createElement('input');
			search.type = 'search';
			expect(isTypingTarget(search)).toBe(true);
			expect(isTypingTarget(null)).toBe(false);
		});

		it('leaves Enter and Space to a focused control, and Enter on a box to the list', () => {
			const button = document.createElement('button');
			const box = document.createElement('input');
			box.type = 'checkbox';
			expect(isActivationKey(parseBinding('enter')![0])).toBe(true);
			expect(isActivationKey(parseBinding('mod+enter')![0])).toBe(false);
			expect(isControlTarget(button, 'enter')).toBe(true);
			expect(isControlTarget(box, 'space')).toBe(true);
			expect(isControlTarget(box, 'enter')).toBe(false);
			expect(isControlTarget(document.createElement('div'), 'enter')).toBe(false);
		});

		it('knows an open dialog', () => {
			const doc = document.implementation.createHTMLDocument('t');
			expect(isDialogOpen(doc)).toBe(false);
			const dialog = doc.createElement('nb-dialog-container');
			doc.body.appendChild(dialog);
			(dialog as unknown as { getClientRects: () => unknown[] }).getClientRects = () => [{}];
			expect(isDialogOpen(doc)).toBe(true);
			dialog.setAttribute('aria-hidden', 'true');
			expect(isDialogOpen(doc)).toBe(false);
		});
	});
});
