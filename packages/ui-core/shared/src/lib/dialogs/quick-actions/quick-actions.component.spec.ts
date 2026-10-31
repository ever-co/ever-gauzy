import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { NbMenuItem } from '@nebular/theme';
import { BehaviorSubject } from 'rxjs';
import hotkeys from 'hotkeys-js';
import { IQuickActionsUiPreferences } from '@gauzy/contracts';
import { QuickActionsPreferencesService, TimeTrackerService, ToastrService } from '@gauzy/ui-core/core';
import { IQuickActionEditGroup, QuickActionsComponent } from './quick-actions.component';
import { DialogsModule } from '../dialogs.module';

/**
 * Menu items as the header builds them (titles already translated). The user has no permission for
 * the other actions, so the header leaves them out: Create Estimate (E), Add Employee (A+E), ...
 */
const ITEMS: NbMenuItem[] = [
	{ title: 'Create Invoice', icon: 'archive-outline', link: 'invoices/add', data: { action: 'createInvoice' } },
	{ title: 'Received Invoices', icon: 'archive', link: 'invoices/received', data: { action: 'receivedInvoices' } },
	{ title: 'Create Task', icon: 'calendar-outline', link: 'tasks', data: { action: 'createTask' } },
	{ title: 'View Tasks', icon: 'calendar-outline', link: 'tasks', data: { action: 'viewTasks' } },
	{ title: 'Start Timer', icon: 'play-circle-outline', hidden: true, data: { action: 'startTimer' } },
	{ title: 'Not a quick action', link: 'elsewhere', data: { action: 'somethingElse' } }
];

const key = (key: string, init: KeyboardEventInit = {}) => ({ key, bubbles: true, cancelable: true, ...init });

describe('QuickActionsComponent', () => {
	let component: QuickActionsComponent;
	let fixture: ComponentFixture<QuickActionsComponent>;
	let preferences$: BehaviorSubject<IQuickActionsUiPreferences | null>;
	let preferencesService: {
		preferences$: BehaviorSubject<IQuickActionsUiPreferences | null>;
		editing: ReturnType<typeof signal<boolean>>;
		setEditing: jest.Mock;
		save: jest.Mock;
	};
	let toastr: { success: jest.Mock; danger: jest.Mock };

	const element = (): HTMLElement => fixture.nativeElement;
	const query = <T extends HTMLElement = HTMLElement>(selector: string): T => element().querySelector<T>(selector);
	const queryAll = <T extends HTMLElement = HTMLElement>(selector: string): T[] => [
		...element().querySelectorAll<T>(selector)
	];

	/** The edit row of an action, by its title. */
	const row = (title: string): HTMLElement =>
		queryAll('li.edit-item').find((li) => li.querySelector('.action-title').textContent.trim() === title);
	const shortcutButton = (title: string) => row(title).querySelector<HTMLButtonElement>('button.shortcut');
	const accountingOrder = () =>
		component.editGroups.find(({ group }) => group === 'accounting').items.map(({ id }) => id);

	/** Clicks an action's shortcut button, then presses and releases the keys (modifiers via `init`). */
	function record(title: string, pressed: string, init: KeyboardEventInit = {}): KeyboardEvent[] {
		const button = shortcutButton(title);
		button.click();
		fixture.detectChanges();
		const events = [
			new KeyboardEvent('keydown', key(pressed, init)),
			new KeyboardEvent('keyup', key(pressed, init))
		];
		events.forEach((event) => button.dispatchEvent(event));
		fixture.detectChanges();
		return events;
	}

	function startEditing(): void {
		query<HTMLButtonElement>('button.edit').click();
		fixture.detectChanges();
	}

	async function clickSave(): Promise<void> {
		query<HTMLButtonElement>('button.save').click();
		await fixture.whenStable();
		await Promise.resolve();
		fixture.detectChanges();
	}

	beforeEach(async () => {
		preferences$ = new BehaviorSubject<IQuickActionsUiPreferences | null>(null);
		const editing = signal(false);
		preferencesService = {
			preferences$,
			editing,
			setEditing: jest.fn((value: boolean) => editing.set(value)),
			save: jest.fn().mockResolvedValue(undefined)
		};
		toastr = { success: jest.fn(), danger: jest.fn() };

		await TestBed.configureTestingModule({
			// Declared in DialogsModule (not standalone): import it so the template gets that module's scope. The real
			// TimeTrackerService starts a Web Worker, which jsdom lacks; the menu only reads `running`.
			imports: [DialogsModule],
			providers: [
				{ provide: TimeTrackerService, useValue: { running: false } },
				{ provide: QuickActionsPreferencesService, useValue: preferencesService },
				{ provide: ToastrService, useValue: toastr }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(QuickActionsComponent);
		component = fixture.componentInstance;
		component.items = ITEMS;
		component.shortcutDialog = 'ctrl+Q';
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('without a customization', () => {
		it('groups the actions as before, biggest groups first, with the built-in shortcuts as badges', () => {
			const groups = component.groupedQuickActions.filter(({ items }) => items.length);
			expect(groups.map(({ groupTitle }) => groupTitle)).toEqual([
				'QUICK_ACTIONS_GROUP.ACCOUNTING',
				'QUICK_ACTIONS_GROUP.PROJECT_MANAGEMENT',
				'QUICK_ACTIONS_GROUP.TIME_TRACKING'
			]);
			expect(groups.map(({ items }) => items.map(({ title, badge }) => [title, badge?.text]))).toEqual([
				[
					['Create Invoice', 'I'],
					['Received Invoices', 'SHIFT + I']
				],
				[
					['Create Task', 'T'],
					['View Tasks', 'SHIFT + T']
				],
				[['Start Timer', 'S']]
			]);
		});

		it('always lists the timer actions', () => {
			const timer = component.groupedQuickActions.find(({ group }) => group === 'time_tracking');
			expect(timer.items[0].hidden).toBe(false);
		});

		it('renders one menu per non-empty group', () => {
			expect(queryAll('p.group-header').map((p) => p.textContent.trim())).toEqual([
				'QUICK_ACTIONS_GROUP.ACCOUNTING',
				'QUICK_ACTIONS_GROUP.PROJECT_MANAGEMENT',
				'QUICK_ACTIONS_GROUP.TIME_TRACKING'
			]);
			expect(queryAll('nb-menu')).toHaveLength(3);
		});
	});

	it('shows the shortcuts the header binds: a saved key of an action the user cannot run takes nothing', async () => {
		// -- Create Estimate is not in the menu; its saved I must not displace Create Invoice's default
		preferences$.next({ shortcuts: { createEstimate: 'i' } });
		expect(component.groupedQuickActions[0].items[0].badge.text).toBe('I');

		startEditing();
		expect(component.draftShortcuts['createInvoice']).toBe('i');
		await clickSave();
		// -- the saved choice is kept for when the action is available again
		expect(preferencesService.save).toHaveBeenCalledWith({ shortcuts: { createEstimate: 'i' } });
	});

	it('follows the saved order and shortcuts, and regroups when they change', () => {
		preferences$.next({
			order: ['receivedInvoices', 'createInvoice'],
			shortcuts: { createInvoice: '', createTask: 'y' }
		});
		const [accounting, pm] = component.groupedQuickActions;
		expect(accounting.items.map(({ title, badge }) => [title, badge?.text])).toEqual([
			['Received Invoices', 'SHIFT + I'],
			['Create Invoice', undefined]
		]);
		expect(pm.items[0].badge.text).toBe('Y');

		preferences$.next(null);
		expect(component.groupedQuickActions[0].items[0].title).toBe('Create Invoice');
	});

	describe('edit mode', () => {
		it('opens from the pencil button and pauses the global shortcuts', () => {
			startEditing();
			expect(component.editMode).toBe(true);
			expect(preferencesService.editing()).toBe(true);
			expect(query('button.edit')).toBeNull();
			expect(queryAll('li.edit-item').map((li) => li.querySelector('.action-title').textContent.trim())).toEqual([
				'Create Invoice',
				'Received Invoices',
				'Create Task',
				'View Tasks',
				'Start Timer'
			]);
		});

		it('labels every control for assistive technology', () => {
			startEditing();
			const buttons = queryAll<HTMLButtonElement>('li.edit-item button');
			expect(buttons.length).toBe(5 * 4);
			buttons.forEach((button) => expect(button.getAttribute('aria-label')).toBeTruthy());
			expect(query('#qa-move-up-createInvoice').getAttribute('aria-label')).toBe(
				'QUICK_ACTIONS_CUSTOMIZE.MOVE_UP'
			);
			expect(shortcutButton('Create Task').getAttribute('aria-describedby')).toBe('qa-error-createTask');
			expect(query('ul.edit-list').getAttribute('aria-labelledby')).toBe('qa-group-accounting');
			expect(query('span.cancel').getAttribute('role')).toBe('button');
		});

		it('disables moving past either end of a group', () => {
			startEditing();
			expect(query<HTMLButtonElement>('#qa-move-up-createInvoice').disabled).toBe(true);
			expect(query<HTMLButtonElement>('#qa-move-down-createInvoice').disabled).toBe(false);
			expect(query<HTMLButtonElement>('#qa-move-down-receivedInvoices').disabled).toBe(true);
		});

		it('moves an action with the keyboard, announces it, keeps the focus on the row and saves the order', async () => {
			startEditing();
			query<HTMLButtonElement>('#qa-move-down-createInvoice').click();
			fixture.detectChanges();

			expect(accountingOrder()).toEqual(['receivedInvoices', 'createInvoice']);
			expect(query('p[role="status"]').textContent.trim()).toBe('QUICK_ACTIONS_CUSTOMIZE.MOVED');
			await new Promise((resolve) => setTimeout(resolve));
			expect(document.activeElement?.id).toBe('qa-move-up-createInvoice');

			await clickSave();
			expect(preferencesService.save).toHaveBeenCalledTimes(1);
			const [saved] = preferencesService.save.mock.calls[0];
			expect(Object.keys(saved)).toEqual(['order']);
			expect(saved.order.indexOf('receivedInvoices')).toBeLessThan(saved.order.indexOf('createInvoice'));
			expect(toastr.success).toHaveBeenCalledWith('QUICK_ACTIONS_CUSTOMIZE.SAVED');
			expect(component.editMode).toBe(false);
			expect(preferencesService.editing()).toBe(false);
		});

		it('reorders on drop', () => {
			startEditing();
			const accounting = component.editGroups.find(({ group }) => group === 'accounting');
			component.drop(accounting, { previousIndex: 1, currentIndex: 0 } as CdkDragDrop<IQuickActionEditGroup>);
			expect(accountingOrder()).toEqual(['receivedInvoices', 'createInvoice']);
		});

		it('records a shortcut: click, then press the keys', async () => {
			startEditing();
			const events = record('Create Task', 'Y', { shiftKey: true });

			expect(events.every((event) => event.defaultPrevented)).toBe(true);
			expect(component.draftShortcuts['createTask']).toBe('shift+y');
			expect(shortcutButton('Create Task').textContent.trim()).toBe('SHIFT + Y');
			expect(component.capturingId).toBeNull();

			await clickSave();
			expect(preferencesService.save).toHaveBeenCalledWith({ shortcuts: { createTask: 'shift+y' } });
		});

		it('shows what is held while recording', () => {
			startEditing();
			const button = shortcutButton('Create Task');
			button.click();
			fixture.detectChanges();
			expect(button.textContent.trim()).toBe('QUICK_ACTIONS_CUSTOMIZE.PRESS_KEYS');
			button.dispatchEvent(new KeyboardEvent('keydown', key('Shift', { shiftKey: true })));
			fixture.detectChanges();
			expect(button.textContent.trim()).toBe('SHIFT');
		});

		it('refuses a combination another action uses', () => {
			startEditing();
			record('Create Task', 'i');
			expect(component.draftShortcuts['createTask']).toBe('t');
			expect(row('Create Task').querySelector('p.shortcut-error').textContent.trim()).toBe(
				'QUICK_ACTIONS_CUSTOMIZE.ERRORS.CONFLICT'
			);

			record('Create Task', 'y');
			expect(component.draftShortcuts['createTask']).toBe('y');
			expect(row('Create Task').querySelector('p.shortcut-error').textContent.trim()).toBe('');
		});

		describe('with actions the user cannot see', () => {
			it('gives the user a key a hidden action has by default; the hidden action loses it', async () => {
				startEditing();
				record('Create Task', 'e');
				expect(component.shortcutErrors['createTask']).toBeUndefined();
				expect(component.draftShortcuts['createTask']).toBe('e');
				// -- an action the user cannot run is not resolved at all: it holds no key
				expect('createEstimate' in component.draftShortcuts).toBe(false);

				await clickSave();
				// -- the displaced default is not stored as a removal: it comes back once E is free again
				expect(preferencesService.save).toHaveBeenCalledWith({ shortcuts: { createTask: 'e' } });
			});

			it('takes the key of an action that works without being listed (Stop Timer), which then loses it', async () => {
				startEditing();
				expect(component.draftShortcuts['stopTimer']).toBe('o');
				record('Create Task', 'o');
				expect(component.shortcutErrors['createTask']).toBeUndefined();
				expect(component.draftShortcuts['createTask']).toBe('o');
				expect(component.draftShortcuts['stopTimer']).toBe('');

				await clickSave();
				expect(preferencesService.save).toHaveBeenCalledWith({ shortcuts: { createTask: 'o' } });
			});

			it('is not blocked by the start of a hidden two-key shortcut', () => {
				startEditing();
				record('Create Task', 'a');
				expect(component.draftShortcuts['createTask']).toBe('a');
				expect('addEmployee' in component.draftShortcuts).toBe(false);
				expect('addDepartment' in component.draftShortcuts).toBe(false);
			});

			it('takes a key from a hidden action’s own saved shortcut, which falls back to its default', async () => {
				preferences$.next({ shortcuts: { createEstimate: 'y' } });
				startEditing();
				record('Create Task', 'y');
				expect(component.draftShortcuts['createTask']).toBe('y');
				expect('createEstimate' in component.draftShortcuts).toBe(false);

				await clickSave();
				expect(preferencesService.save).toHaveBeenCalledWith({ shortcuts: { createTask: 'y' } });
			});
		});

		it('does not save a default that a saved shortcut only displaces', async () => {
			preferences$.next({ shortcuts: { createTask: 'i' } });
			startEditing();
			expect(component.draftShortcuts['createInvoice']).toBe('');
			expect(shortcutButton('Create Invoice').textContent.trim()).toBe('QUICK_ACTIONS_CUSTOMIZE.NO_SHORTCUT');

			record('View Tasks', 'y');
			await clickSave();
			expect(preferencesService.save).toHaveBeenCalledWith({ shortcuts: { createTask: 'i', viewTasks: 'y' } });
		});

		it('gives a displaced default back when its key is freed', () => {
			preferences$.next({ shortcuts: { createTask: 'i' } });
			startEditing();
			record('Create Task', 'y');
			expect(component.draftShortcuts['createInvoice']).toBe('i');
		});

		it('refuses combinations the browser or the system own', () => {
			startEditing();
			record('Create Task', 'y', { ctrlKey: true });
			expect(component.draftShortcuts['createTask']).toBe('t');
			expect(component.shortcutErrors['createTask']).toBe('QUICK_ACTIONS_CUSTOMIZE.ERRORS.RESERVED');
		});

		it('clears a shortcut with Backspace or the clear button', () => {
			startEditing();
			record('Create Task', 'Backspace');
			expect(component.draftShortcuts['createTask']).toBe('');
			expect(shortcutButton('Create Task').textContent.trim()).toBe('QUICK_ACTIONS_CUSTOMIZE.NO_SHORTCUT');

			const clear = row('View Tasks').querySelectorAll<HTMLButtonElement>('button')[3];
			clear.click();
			fixture.detectChanges();
			expect(component.draftShortcuts['viewTasks']).toBe('');
			expect(clear.disabled).toBe(true);
		});

		it('cancels a recording with Escape without closing the dialog', () => {
			startEditing();
			const onDocumentKeyup = jest.fn();
			document.addEventListener('keyup', onDocumentKeyup);
			try {
				record('Create Task', 'Escape');
			} finally {
				document.removeEventListener('keyup', onDocumentKeyup);
			}
			expect(onDocumentKeyup).not.toHaveBeenCalled();
			expect(component.capturingId).toBeNull();
			expect(component.draftShortcuts['createTask']).toBe('t');
			expect(component.editMode).toBe(true);
		});

		it('lets the release of the Enter that started a recording reach the page, so no key stays held', () => {
			// -- hotkeys-js listens on the document, like the header's shortcuts do
			hotkeys('*', 'quick-actions-spec', () => undefined);
			try {
				startEditing();
				const button = shortcutButton('Create Task');
				// -- Enter on a focused button: its keydown reaches the document, then it presses the button
				button.dispatchEvent(new KeyboardEvent('keydown', key('Enter')));
				expect(hotkeys.getPressedKeyCodes()).toEqual([13]);
				button.click();
				fixture.detectChanges();
				expect(component.capturingId).toBe('createTask');

				const release = new KeyboardEvent('keyup', key('Enter'));
				button.dispatchEvent(release);
				expect(release.defaultPrevented).toBe(false);
				expect(hotkeys.getPressedKeyCodes()).toEqual([]);
				expect(component.capturingId).toBe('createTask');

				query<HTMLButtonElement>('button.cancel-edit').click();
				fixture.detectChanges();
				expect(preferencesService.setEditing).toHaveBeenLastCalledWith(false);
				expect(hotkeys.getPressedKeyCodes()).toEqual([]);
			} finally {
				hotkeys.unbind('*', 'quick-actions-spec');
			}
		});

		it('lets Tab move the focus on', () => {
			startEditing();
			const button = shortcutButton('Create Task');
			button.click();
			const tab = new KeyboardEvent('keydown', key('Tab'));
			button.dispatchEvent(tab);
			expect(tab.defaultPrevented).toBe(false);
			expect(component.capturingId).toBeNull();
		});

		it('resets to the built-in layout, which removes the customization on save', async () => {
			preferences$.next({ order: ['receivedInvoices', 'createInvoice'], shortcuts: { createTask: 'y' } });
			startEditing();
			expect(component.draftShortcuts['createTask']).toBe('y');

			query<HTMLButtonElement>('button.reset').click();
			fixture.detectChanges();
			expect(component.draftShortcuts['createTask']).toBe('t');
			expect(accountingOrder()).toEqual(['createInvoice', 'receivedInvoices']);
			expect(preferencesService.save).not.toHaveBeenCalled();

			await clickSave();
			expect(preferencesService.save).toHaveBeenCalledWith(null);
		});

		it('discards the draft on cancel', () => {
			startEditing();
			record('Create Task', 'y');
			query<HTMLButtonElement>('button.cancel-edit').click();
			fixture.detectChanges();

			expect(component.editMode).toBe(false);
			expect(preferencesService.editing()).toBe(false);
			expect(preferencesService.save).not.toHaveBeenCalled();
			expect(queryAll('nb-menu')).toHaveLength(3);

			startEditing();
			expect(component.draftShortcuts['createTask']).toBe('t');
		});

		it('stays in edit mode and tells the user when saving fails', async () => {
			const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			preferencesService.save.mockRejectedValueOnce(new Error('offline'));
			startEditing();
			record('Create Task', 'y');

			await clickSave();
			expect(toastr.danger).toHaveBeenCalledWith('QUICK_ACTIONS_CUSTOMIZE.SAVE_ERROR');
			expect(toastr.success).not.toHaveBeenCalled();
			expect(component.editMode).toBe(true);
			expect(component.saving).toBe(false);
			expect(component.draftShortcuts['createTask']).toBe('y');
			consoleError.mockRestore();
		});

		it('locks the draft while the save is pending', async () => {
			let finish: () => void;
			preferencesService.save.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
			startEditing();
			record('Create Task', 'y');
			query<HTMLButtonElement>('button.save').click();
			fixture.detectChanges();

			expect(component.saving).toBe(true);
			for (const selector of [
				'button.reset',
				'button.cancel-edit',
				'button.save',
				'#qa-move-down-createInvoice'
			]) {
				expect(query<HTMLButtonElement>(selector).disabled).toBe(true);
			}
			expect(shortcutButton('Create Task').disabled).toBe(true);
			component.resetToDefaults();
			component.clearShortcut('createTask');
			component.startCapture('viewTasks');
			expect(component.draftShortcuts['createTask']).toBe('y');
			expect(component.capturingId).toBeNull();

			finish();
			await fixture.whenStable();
			await Promise.resolve();
			expect(component.editMode).toBe(false);
		});

		it('leaves the editing state alone when a save completes after the dialog closed', async () => {
			let finish: () => void;
			preferencesService.save.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
			startEditing();
			query<HTMLButtonElement>('button.save').click();
			fixture.destroy();
			expect(preferencesService.editing()).toBe(false);

			// -- another Quick Actions dialog is being customized when the old request completes
			preferencesService.setEditing(true);
			finish();
			await Promise.resolve();
			await Promise.resolve();
			expect(preferencesService.editing()).toBe(true);
			expect(toastr.success).toHaveBeenCalledWith('QUICK_ACTIONS_CUSTOMIZE.SAVED');
		});

		it('resumes the global shortcuts when the dialog closes while editing', () => {
			startEditing();
			fixture.destroy();
			expect(preferencesService.editing()).toBe(false);
		});
	});
});
