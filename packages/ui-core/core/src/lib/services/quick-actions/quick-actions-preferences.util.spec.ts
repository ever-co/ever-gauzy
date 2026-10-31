import {
	getDefaultQuickActionShortcuts,
	IQuickActionDefinition,
	QUICK_ACTION_DEFINITIONS,
	QuickActionGroupEnum
} from './quick-action.definitions';
import { normalizeShortcut } from './quick-action-shortcut.util';
import {
	getQuickActionBindings,
	reorderSubset,
	resolveQuickActionOrder,
	resolveQuickActionShortcuts,
	sanitizeQuickActionsPreferences,
	sortByQuickActionOrder,
	toQuickActionsPreferences,
	withQuickActionShortcut
} from './quick-actions-preferences.util';

const DEFAULT_IDS = QUICK_ACTION_DEFINITIONS.map(({ id }) => id);

/** What every user without a saved customization gets: the header's historical shortcuts, canonical. */
const DEFAULT_SHORTCUTS: Record<string, string> = Object.fromEntries(
	QUICK_ACTION_DEFINITIONS.map(({ id, shortcut }) => [id, normalizeShortcut(shortcut)])
);

/** A small catalogue for the cases that need actions to come and go. */
const TINY: IQuickActionDefinition[] = [
	{ id: 'one', group: QuickActionGroupEnum.ACCOUNTING, title: 'ONE', shortcut: 'o' },
	{ id: 'two', group: QuickActionGroupEnum.ACCOUNTING, title: 'TWO', shortcut: 'w' },
	{ id: 'three', group: QuickActionGroupEnum.CONTACTS, title: 'THREE', shortcut: 'shift+t' }
];

describe('quick-actions-preferences.util', () => {
	describe('the built-in catalogue', () => {
		it('has unique ids', () => {
			expect(new Set(DEFAULT_IDS).size).toBe(DEFAULT_IDS.length);
		});

		it('keeps the shortcuts the header has always registered', () => {
			expect(getDefaultQuickActionShortcuts()).toEqual({
				createInvoice: 'I',
				receivedInvoices: 'shift+I',
				createEstimate: 'E',
				receivedEstimates: 'shift+E',
				createPayment: 'P',
				createIncome: 'C',
				createExpense: 'X',
				createTeam: 'G',
				createTask: 'T',
				createProject: 'J',
				viewTasks: 'shift+T',
				viewTeamTasks: 'shift+G',
				addEmployee: 'A+E',
				addInventory: 'A+I',
				addEquipment: 'A+Q',
				addVendor: 'A+V',
				addDepartment: 'A+D',
				timeLog: 'shift+L',
				viewAppointments: 'shift+A',
				viewTimeActivity: 'shift+S',
				startTimer: 'S',
				stopTimer: 'O',
				createCandidate: 'U',
				createProposal: 'R',
				createContract: 'K',
				createLead: 'D',
				createCustomer: 'M',
				createClient: 'N',
				viewClients: 'shift+N'
			});
		});
	});

	describe('sanitizeQuickActionsPreferences', () => {
		it('returns null for nothing usable', () => {
			expect(sanitizeQuickActionsPreferences(undefined)).toBeNull();
			expect(sanitizeQuickActionsPreferences(null)).toBeNull();
			expect(sanitizeQuickActionsPreferences('x')).toBeNull();
			expect(sanitizeQuickActionsPreferences([])).toBeNull();
			expect(sanitizeQuickActionsPreferences({})).toBeNull();
			expect(sanitizeQuickActionsPreferences({ order: 'createTask', shortcuts: [] })).toBeNull();
		});

		it('keeps known ids only, once, in order', () => {
			expect(
				sanitizeQuickActionsPreferences({ order: ['viewTasks', 'removedAction', 7, 'createTask', 'viewTasks'] })
			).toEqual({ order: ['viewTasks', 'createTask'] });
		});

		it('normalizes shortcuts and keeps removals', () => {
			expect(
				sanitizeQuickActionsPreferences({ shortcuts: { createTask: 'Shift+Y', createInvoice: '' } })
			).toEqual({ shortcuts: { createTask: 'shift+y', createInvoice: '' } });
		});

		it('drops shortcuts of unknown actions, non-strings and combinations a user could not record', () => {
			expect(
				sanitizeQuickActionsPreferences({
					shortcuts: { gone: 'y', createTask: 5, createInvoice: 'ctrl+k', viewTasks: 'f1', createTeam: 'z' }
				})
			).toEqual({ shortcuts: { createTeam: 'z' } });
		});

		it('ignores prototype keys', () => {
			const stored = JSON.parse('{"shortcuts":{"__proto__":"y","constructor":"z"},"order":["__proto__"]}');
			expect(sanitizeQuickActionsPreferences(stored)).toBeNull();
		});
	});

	describe('resolveQuickActionShortcuts', () => {
		it('gives the built-in shortcuts when nothing is saved', () => {
			expect(resolveQuickActionShortcuts(null)).toEqual(DEFAULT_SHORTCUTS);
			expect(resolveQuickActionShortcuts(undefined)).toEqual(DEFAULT_SHORTCUTS);
			expect(resolveQuickActionShortcuts({})).toEqual(DEFAULT_SHORTCUTS);
			expect(DEFAULT_SHORTCUTS['newDocumentPage']).toBe('');
		});

		it('applies the user’s shortcuts and removals', () => {
			const shortcuts = resolveQuickActionShortcuts({ shortcuts: { createTask: 'y', viewTasks: '' } });
			expect(shortcuts['createTask']).toBe('y');
			expect(shortcuts['viewTasks']).toBe('');
			expect(shortcuts['createInvoice']).toBe('i');
		});

		it('drops a default whose combination the user gave to another action', () => {
			const shortcuts = resolveQuickActionShortcuts({ shortcuts: { createTask: 'i', createInvoice: '' } });
			expect(shortcuts['createTask']).toBe('i');
			expect(shortcuts['createInvoice']).toBe('');

			const stale = resolveQuickActionShortcuts({ shortcuts: { newDocumentPage: 'i' } });
			expect(stale['newDocumentPage']).toBe('i');
			expect(stale['createInvoice']).toBe('');
		});

		it('drops defaults that a saved single key would shadow', () => {
			const shortcuts = resolveQuickActionShortcuts({ shortcuts: { createTask: 'a' } });
			expect(shortcuts['createTask']).toBe('a');
			expect(shortcuts['addEmployee']).toBe('');
			expect(shortcuts['addInventory']).toBe('');
		});

		it('falls back to the default for an unusable or clashing saved shortcut', () => {
			expect(resolveQuickActionShortcuts({ shortcuts: { createTask: 'ctrl+t' } })['createTask']).toBe('t');
			const clashing = resolveQuickActionShortcuts({ shortcuts: { createInvoice: 'y', createTask: 'y' } });
			expect(clashing['createInvoice']).toBe('y');
			expect(clashing['createTask']).toBe('t');
		});

		it('gives actions added after the user saved their default shortcut', () => {
			const saved = { shortcuts: { one: 'z' } };
			expect(resolveQuickActionShortcuts(saved, TINY.slice(0, 1))).toEqual({ one: 'z' });
			expect(resolveQuickActionShortcuts(saved, TINY)).toEqual({ one: 'z', two: 'w', three: 'shift+t' });
		});
	});

	describe('withQuickActionShortcut', () => {
		it('records the choice in canonical spelling and leaves the input alone', () => {
			const before = { viewTasks: '' };
			expect(withQuickActionShortcut(before, 'createTask', 'Shift+Y')).toEqual({
				viewTasks: '',
				createTask: 'shift+y'
			});
			expect(before).toEqual({ viewTasks: '' });
		});

		it('records a removal on purpose', () => {
			expect(withQuickActionShortcut({ createInvoice: 'y' }, 'createTask', '')).toEqual({
				createInvoice: 'y',
				createTask: ''
			});
		});

		it('drops the other choices that clash with it (the latest choice wins)', () => {
			const before = { createInvoice: 'y', viewTasks: '', createTeam: 'a' };
			expect(withQuickActionShortcut(before, 'createTask', 'y')).toEqual({
				viewTasks: '',
				createTeam: 'a',
				createTask: 'y'
			});
			expect(withQuickActionShortcut(before, 'createTask', 'a+e')).toEqual({
				createInvoice: 'y',
				viewTasks: '',
				createTask: 'a+e'
			});
		});

		it('lets an action whose choice was dropped fall back to its default', () => {
			const overrides = withQuickActionShortcut({ createInvoice: 'y' }, 'createTask', 'y');
			const shortcuts = resolveQuickActionShortcuts({ shortcuts: overrides });
			expect(shortcuts['createTask']).toBe('y');
			expect(shortcuts['createInvoice']).toBe('i');
		});
	});

	describe('getQuickActionBindings', () => {
		it('lists the available actions that have a shortcut, in definition order', () => {
			const shortcuts = resolveQuickActionShortcuts({ shortcuts: { createTask: 'i' } });
			const available = new Set(['viewTasks', 'createInvoice', 'createTask', 'newDocumentPage']);
			expect(getQuickActionBindings(shortcuts, (id) => available.has(id))).toEqual([
				['createTask', 'i'],
				['viewTasks', 'shift+t']
			]);
		});

		it('binds nothing for an action the user may not run', () => {
			expect(getQuickActionBindings(DEFAULT_SHORTCUTS, () => false)).toEqual([]);
			expect(getQuickActionBindings(DEFAULT_SHORTCUTS, () => true)).toHaveLength(29);
		});
	});

	describe('resolveQuickActionOrder', () => {
		it('gives the built-in order when nothing is saved', () => {
			expect(resolveQuickActionOrder(null)).toEqual(DEFAULT_IDS);
		});

		it('puts the saved ids first and every other action after them, in default order', () => {
			expect(resolveQuickActionOrder({ order: ['two'] }, TINY)).toEqual(['two', 'one', 'three']);
		});

		it('ignores unknown and repeated ids', () => {
			expect(resolveQuickActionOrder({ order: ['three', 'gone', 'three', 'one'] }, TINY)).toEqual([
				'three',
				'one',
				'two'
			]);
		});
	});

	describe('sortByQuickActionOrder', () => {
		it('sorts by place in the order, unknown ids last, stable', () => {
			const items = [{ id: 'x' }, { id: 'one' }, { id: 'y' }, { id: 'two' }];
			expect(sortByQuickActionOrder(items, ['two', 'one'], (item) => item.id).map(({ id }) => id)).toEqual([
				'two',
				'one',
				'x',
				'y'
			]);
		});

		it('does not mutate the input', () => {
			const items = [{ id: 'two' }, { id: 'one' }];
			sortByQuickActionOrder(items, ['one', 'two'], (item) => item.id);
			expect(items.map(({ id }) => id)).toEqual(['two', 'one']);
		});
	});

	describe('reorderSubset', () => {
		it('reorders the subset in its own slots and leaves the other ids in place', () => {
			expect(reorderSubset(['a', 'hidden', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'hidden', 'a', 'b']);
		});

		it('ignores ids that are not in the order', () => {
			expect(reorderSubset(['a', 'b'], ['b', 'ghost', 'a'])).toEqual(['b', 'a']);
		});
	});

	describe('toQuickActionsPreferences', () => {
		it('returns null for the default layout (nothing to store)', () => {
			expect(toQuickActionsPreferences(DEFAULT_IDS, DEFAULT_SHORTCUTS)).toBeNull();
			expect(toQuickActionsPreferences([], {})).toBeNull();
		});

		it('stores only the shortcuts that differ from their default', () => {
			expect(
				toQuickActionsPreferences(DEFAULT_IDS, { ...DEFAULT_SHORTCUTS, createTask: 'Y', createInvoice: '' })
			).toEqual({ shortcuts: { createInvoice: '', createTask: 'y' } });
		});

		it('stores the order when a group’s sequence changed', () => {
			const order = reorderSubset(DEFAULT_IDS, ['receivedInvoices', 'createInvoice']);
			expect(toQuickActionsPreferences(order, DEFAULT_SHORTCUTS)).toEqual({ order });
		});

		it('does not store an order that only interleaves groups differently', () => {
			const order = [...DEFAULT_IDS].sort((a, b) => {
				const groupOf = (id: string) => QUICK_ACTION_DEFINITIONS.find((d) => d.id === id).group;
				return groupOf(a).localeCompare(groupOf(b)) || DEFAULT_IDS.indexOf(a) - DEFAULT_IDS.indexOf(b);
			});
			expect(order).not.toEqual(DEFAULT_IDS);
			expect(toQuickActionsPreferences(order, DEFAULT_SHORTCUTS)).toBeNull();
		});

		it('never stores a default that is only displaced, so it comes back once its key is free', () => {
			const stored = { newDocumentPage: 'i' };
			expect(resolveQuickActionShortcuts({ shortcuts: stored })['createInvoice']).toBe('');

			const saved = toQuickActionsPreferences(DEFAULT_IDS, stored);
			expect(saved).toEqual({ shortcuts: { newDocumentPage: 'i' } });

			const moved = withQuickActionShortcut(saved.shortcuts, 'newDocumentPage', 'shift+p');
			expect(resolveQuickActionShortcuts({ shortcuts: moved })['createInvoice']).toBe('i');
			expect(toQuickActionsPreferences(DEFAULT_IDS, moved)).toEqual({
				shortcuts: { newDocumentPage: 'shift+p' }
			});
		});

		it('round-trips through the resolvers', () => {
			const order = reorderSubset(DEFAULT_IDS, ['viewTeamTasks', 'createTeam']);
			const shortcuts = { ...DEFAULT_SHORTCUTS, createInvoice: '', createTask: 'i', newDocumentPage: 'shift+p' };
			const saved = sanitizeQuickActionsPreferences(toQuickActionsPreferences(order, shortcuts));
			expect(resolveQuickActionShortcuts(saved)).toEqual(shortcuts);
			expect(resolveQuickActionOrder(saved)).toEqual(order);
		});
	});
});
