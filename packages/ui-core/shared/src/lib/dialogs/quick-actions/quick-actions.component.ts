import { Component, ElementRef, Input, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { NbDialogRef, NbIconLibraries, NbMenuItem, NbMenuService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IQuickActionsUiPreferences, TimeLogType } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	IQuickActionShortcutError,
	QUICK_ACTION_GROUP_TITLES,
	QuickActionGroupEnum,
	QuickActionsPreferencesService,
	ShortcutRecorder,
	ShortcutRecorderResult,
	START_TIMER_QUICK_ACTION,
	STOP_TIMER_QUICK_ACTION,
	TimeTrackerService,
	ToastrService,
	findQuickActionDefinition,
	formatShortcut,
	getQuickActionId,
	reorderSubset,
	resolveQuickActionOrder,
	resolveQuickActionShortcuts,
	sortByQuickActionOrder,
	toQuickActionsPreferences,
	validateQuickActionShortcut,
	withQuickActionShortcut
} from '@gauzy/ui-core/core';

type GroupType = {
	group: QuickActionGroupEnum;
	groupTitle: string;
	items: NbMenuItem[];
};

/** One action as the edit mode lists it. */
export interface IQuickActionEditItem {
	id: string;
	title: string;
	icon: NbMenuItem['icon'];
}

/** One group of the edit mode. */
export interface IQuickActionEditGroup {
	group: QuickActionGroupEnum;
	groupTitle: string;
	items: IQuickActionEditItem[];
}

@UntilDestroy()
@Component({
	selector: 'ngx-quick-actions',
	templateUrl: './quick-actions.component.html',
	styleUrls: ['./quick-actions.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class QuickActionsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() items: NbMenuItem[] = [];
	@Input() shortcutDialog = '';

	groupedQuickActions: GroupType[];
	actions = {
		START_TIMER: START_TIMER_QUICK_ACTION,
		STOP_TIMER: STOP_TIMER_QUICK_ACTION
	};

	/** Edit mode: the user reorders the actions and changes their shortcuts. */
	editMode = false;
	/** True while the customization is being saved. */
	saving = false;
	/** The groups as the edit mode lists them (the user's visible actions, in the draft order). */
	editGroups: IQuickActionEditGroup[] = [];
	/**
	 * Draft while editing: the effective shortcut of every built-in action (`''` = none), derived
	 * from the defaults and `draftOverrides`.
	 */
	draftShortcuts: Record<string, string> = {};
	/** The action whose shortcut is being recorded, and what has been pressed so far. */
	capturingId: string | null = null;
	capturePreview = '';
	/** Why the last shortcut recorded for an action was refused (translated), by action id. */
	shortcutErrors: Record<string, string> = {};
	/** Screen-reader announcement of the last reorder. */
	statusMessage = '';

	/** Draft while editing: the effective order of every built-in action. */
	private draftOrder: string[] = [];
	/**
	 * Draft while editing: the user's own shortcut choices (`''` = removed on purpose). Only these
	 * are saved; an action whose default is taken by one of them is just left without a shortcut.
	 */
	private draftOverrides: Record<string, string> = {};
	/** The actions this dialog lists, i.e. the ones the user may run. */
	private visibleIds = new Set<string>();
	private recorder: ShortcutRecorder | null = null;
	private preferences: IQuickActionsUiPreferences | null = null;

	constructor(
		public readonly translate: TranslateService,
		private readonly dialogRef: NbDialogRef<QuickActionsComponent>,
		private readonly nbMenuService: NbMenuService,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly iconLibraries: NbIconLibraries,
		private readonly quickActionsPreferencesService: QuickActionsPreferencesService,
		private readonly toastrService: ToastrService,
		private readonly elementRef: ElementRef<HTMLElement>
	) {
		super(translate);
		this.iconLibraries.registerFontPack('font-awesome', {
			packClass: 'fas',
			iconClassPrefix: 'fa'
		});
	}

	ngOnInit(): void {
		// -- the user's order and shortcuts; regroup whenever they change (e.g. right after saving)
		this.quickActionsPreferencesService.preferences$
			.pipe(untilDestroyed(this))
			.subscribe((preferences: IQuickActionsUiPreferences | null) => {
				this.preferences = preferences;
				this.groupedQuickActions = this._groupQuickActions(this.items);
			});

		this.nbMenuService
			.onItemClick()
			.pipe(untilDestroyed(this))
			.subscribe(async (e) => {
				if (e.item.data?.action && !e.item.link) {
					switch (e.item.data.action) {
						case this.actions.START_TIMER:
							if (this.timeTrackerService.running) return;
							this.timeTrackerService.setTimeLogType(TimeLogType.TRACKED);
							this.timeTrackerService.openAndStartTimer();
							break;
						case this.actions.STOP_TIMER:
							if (this.timeTrackerService.running) await this.timeTrackerService.toggle();
							break;
					}
				}
				this.closeDialog();
			});
	}

	ngOnDestroy(): void {
		// -- closed while editing: resume the global shortcuts
		if (this.editMode) {
			this.quickActionsPreferencesService.setEditing(false);
		}
	}

	closeDialog() {
		this.dialogRef.close();
	}

	/** Display form of a shortcut (`'shift+i'` → `'SHIFT + I'`). */
	formatShortcut(shortcut: string): string {
		return formatShortcut(shortcut);
	}

	/*
	|--------------------------------------------------------------------------
	| Edit mode
	|--------------------------------------------------------------------------
	*/

	/** Enters the edit mode with a draft of the current order and shortcuts. Global shortcuts pause. */
	startEditing(): void {
		this.visibleIds = new Set(
			(this.items ?? []).map(getQuickActionId).filter((id) => !!findQuickActionDefinition(id))
		);
		this.draftOrder = resolveQuickActionOrder(this.preferences);
		this.setDraftOverrides({ ...(this.preferences?.shortcuts ?? {}) });
		this.shortcutErrors = {};
		this.statusMessage = '';
		this.editMode = true;
		this.quickActionsPreferencesService.setEditing(true);
		this.refreshEditGroups();
	}

	/** Leaves the edit mode without saving. */
	cancelEditing(): void {
		this.stopCapture();
		this.editMode = false;
		this.quickActionsPreferencesService.setEditing(false);
	}

	/** Puts the draft back to the built-in order and shortcuts (saved with Save). */
	resetToDefaults(): void {
		this.stopCapture();
		this.draftOrder = resolveQuickActionOrder(null);
		this.setDraftOverrides({});
		this.shortcutErrors = {};
		this.refreshEditGroups();
	}

	/** Saves the draft (only what differs from the defaults; nothing at all when it is the default layout). */
	async save(): Promise<void> {
		if (this.saving) return;
		this.stopCapture();
		this.saving = true;
		try {
			await this.quickActionsPreferencesService.save(
				toQuickActionsPreferences(this.draftOrder, this.draftOverrides)
			);
			this.cancelEditing();
			this.toastrService.success('QUICK_ACTIONS_CUSTOMIZE.SAVED');
		} catch (error) {
			console.error('Error while saving the quick actions customization:', error);
			this.toastrService.danger('QUICK_ACTIONS_CUSTOMIZE.SAVE_ERROR');
		} finally {
			this.saving = false;
		}
	}

	/** Drag and drop within a group. */
	drop(group: IQuickActionEditGroup, event: CdkDragDrop<IQuickActionEditGroup>): void {
		this.moveAction(group, event.previousIndex, event.currentIndex);
	}

	/** The keyboard alternative to drag and drop: moves an action one place up (-1) or down (+1). */
	move(group: IQuickActionEditGroup, index: number, offset: -1 | 1): void {
		const { id } = group.items[index];
		const position = index + offset;
		if (!this.moveAction(group, index, position)) return;
		// -- the row was re-rendered: give the focus back to the same button, or to the other one at an end
		const atEnd = offset < 0 ? position === 0 : position === group.items.length - 1;
		const direction = offset < 0 !== atEnd ? 'up' : 'down';
		setTimeout(() =>
			this.elementRef.nativeElement.querySelector<HTMLElement>(`#qa-move-${direction}-${id}`)?.focus()
		);
	}

	/** Starts recording a new shortcut for an action ("click, then press the keys"). */
	startCapture(id: string): void {
		this.capturingId = id;
		this.capturePreview = '';
		this.recorder = new ShortcutRecorder();
		this.setError(id, null);
	}

	onCaptureKeydown(event: KeyboardEvent, id: string): void {
		if (this.capturingId === id && this.recorder) {
			this.handleRecorderResult(this.recorder.keydown(event), event, id);
		}
	}

	onCaptureKeyup(event: KeyboardEvent, id: string): void {
		if (this.capturingId === id && this.recorder) {
			this.handleRecorderResult(this.recorder.keyup(event), event, id);
		}
	}

	/** The shortcut button lost the focus: stop recording, keep the shortcut. */
	onCaptureBlur(id: string): void {
		if (this.capturingId === id) {
			this.stopCapture();
		}
	}

	/** Removes an action's shortcut. */
	clearShortcut(id: string): void {
		this.setShortcut(id, '');
	}

	/** Accessible name of an action's shortcut button. */
	getShortcutLabel(item: IQuickActionEditItem): string {
		if (this.capturingId === item.id) {
			return this.getTranslation('QUICK_ACTIONS_CUSTOMIZE.RECORDING', { action: item.title });
		}
		const shortcut =
			this.formatShortcut(this.draftShortcuts[item.id]) ||
			this.getTranslation('QUICK_ACTIONS_CUSTOMIZE.NO_SHORTCUT');
		return this.getTranslation('QUICK_ACTIONS_CUSTOMIZE.CHANGE_SHORTCUT', { action: item.title, shortcut });
	}

	private handleRecorderResult(result: ShortcutRecorderResult, event: KeyboardEvent, id: string): void {
		if (result.status === 'ignored') {
			// -- the release of a key pressed before recording (the Enter that started it): let it through
			return;
		}
		if (result.status === 'released') {
			// -- Tab: stop recording and let the focus move on
			this.stopCapture();
			return;
		}
		// -- the keys belong to the recording: no browser action, no dialog close, no global shortcut
		event.preventDefault();
		event.stopPropagation();
		switch (result.status) {
			case 'recording':
				this.capturePreview = this.formatShortcut(result.preview);
				break;
			case 'recorded':
				this.applyRecordedShortcut(id, result.shortcut);
				this.stopCapture();
				break;
			case 'cleared':
				this.clearShortcut(id);
				this.stopCapture();
				break;
			case 'cancelled':
				this.stopCapture();
				break;
		}
	}

	/**
	 * Takes a recorded shortcut, unless it breaks the rules or another listed action uses it. An
	 * action the user cannot see (no permission) never blocks a key: it loses that key instead.
	 */
	private applyRecordedShortcut(id: string, shortcut: string): void {
		const listed = Object.fromEntries(
			Object.entries(this.draftShortcuts).filter(([other]) => this.visibleIds.has(other))
		);
		const error = validateQuickActionShortcut(shortcut, id, listed);
		if (error) {
			this.setError(id, this.describeError(error, shortcut));
			return;
		}
		this.setShortcut(id, shortcut);
	}

	private stopCapture(): void {
		this.capturingId = null;
		this.capturePreview = '';
		this.recorder = null;
	}

	private setShortcut(id: string, shortcut: string): void {
		this.setDraftOverrides(withQuickActionShortcut(this.draftOverrides, id, shortcut));
		this.setError(id, null);
	}

	private setDraftOverrides(overrides: Record<string, string>): void {
		this.draftOverrides = overrides;
		this.draftShortcuts = resolveQuickActionShortcuts({ shortcuts: overrides });
	}

	private setError(id: string, message: string | null): void {
		const others = { ...this.shortcutErrors };
		delete others[id];
		this.shortcutErrors = message ? { ...others, [id]: message } : others;
	}

	private describeError(error: IQuickActionShortcutError, shortcut: string): string {
		const conflict = findQuickActionDefinition(error.conflictWith);
		return this.getTranslation(`QUICK_ACTIONS_CUSTOMIZE.ERRORS.${error.code}`, {
			shortcut: this.formatShortcut(shortcut),
			action: conflict ? this.getTranslation(conflict.title) : ''
		});
	}

	/** Moves an action within its group in the draft. False when there is nothing to move. */
	private moveAction(group: IQuickActionEditGroup, from: number, to: number): boolean {
		if (from === to || to < 0 || to >= group.items.length) return false;
		const ids = group.items.map(({ id }) => id);
		moveItemInArray(ids, from, to);
		this.draftOrder = reorderSubset(this.draftOrder, ids);
		this.refreshEditGroups();
		this.statusMessage = this.getTranslation('QUICK_ACTIONS_CUSTOMIZE.MOVED', {
			action: group.items[from].title,
			position: to + 1,
			total: ids.length
		});
		return true;
	}

	private refreshEditGroups(): void {
		this.editGroups = this.groupItems(this.items, this.draftOrder)
			.filter(({ items }) => items.length)
			.map(({ group, groupTitle, items }) => ({
				group,
				groupTitle,
				items: items.map((item) => ({ id: getQuickActionId(item), title: item.title, icon: item.icon }))
			}));
	}

	/*
	|--------------------------------------------------------------------------
	| Grouping
	|--------------------------------------------------------------------------
	*/

	/**
	 * Groups the menu items for display: each item in its action's group, in the user's order, with
	 * the user's shortcut as its badge; the groups with the most items first.
	 */
	private _groupQuickActions(items: NbMenuItem[]): GroupType[] {
		const shortcuts = resolveQuickActionShortcuts(this.preferences);
		return this.groupItems(items, resolveQuickActionOrder(this.preferences)).map((group) => ({
			...group,
			items: group.items.map((item) => ({
				...this.withShortcutBadge(item, shortcuts[getQuickActionId(item)]),
				// -- the timer actions are always listed here, whatever the header decided
				...(group.group === QuickActionGroupEnum.TIME_TRACKING ? { hidden: false } : {})
			}))
		}));
	}

	/**
	 * The items of each group in the given order; items that are not a known quick action are left
	 * out. Groups keep their default order before the sort by size (the sort is stable).
	 */
	private groupItems(items: NbMenuItem[], order: ReadonlyArray<string>): GroupType[] {
		const groups = new Map<QuickActionGroupEnum, GroupType>(
			Object.values(QuickActionGroupEnum).map((group) => [
				group,
				{ group, groupTitle: QUICK_ACTION_GROUP_TITLES[group], items: [] }
			])
		);
		for (const item of sortByQuickActionOrder(items ?? [], order, getQuickActionId)) {
			const definition = findQuickActionDefinition(getQuickActionId(item));
			if (definition) {
				groups.get(definition.group).items.push(item);
			}
		}
		return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
	}

	/** The item with its shortcut as badge (no badge without a shortcut). */
	private withShortcutBadge(item: NbMenuItem, shortcut: string | undefined): NbMenuItem {
		const rest: NbMenuItem = { ...item };
		delete rest.badge;
		return shortcut ? { ...rest, badge: { text: formatShortcut(shortcut), status: 'control' } } : rest;
	}
}
