import { HttpErrorResponse } from '@angular/common/http';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	inject,
	OnInit,
	signal,
	ViewChild
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, firstValueFrom, Observable, of } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import {
	ID,
	IPagination,
	ITask,
	ITaskBulkUpdateInput,
	ITaskView,
	ITaskViewFilterGroup,
	ITaskViewGroupCount,
	ITaskViewInvalidFilter,
	ITaskViewOrderInput,
	ITaskViewTasksPage,
	ITaskViewUpdateInput,
	IUser,
	PermissionsEnum,
	TaskBuiltInViewEnum,
	TaskViewGroupBy,
	TaskViewOrderField,
	TaskViewVisibilityEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import {
	BULK_DELETE_CONCURRENCY,
	BULK_UNDO_WINDOW_MS,
	SAVED_VIEWS_MAX,
	SAVED_VIEWS_PAGE_SIZE,
	TASK_PAGE_LINK,
	TASK_SELECTION_LIMIT,
	TASK_VIEW_ORDER_MAX,
	TASK_VIEWS_BUILT_IN_SEGMENT,
	TASK_VIEWS_LINK,
	TASK_VIEWS_PAGE_SIZE
} from '../../task-views-ui.constants';
import { applicableTree, ApplicableTree, conditionsOf, invalidByPath } from '../../models/filter-tree';
import {
	bulkRequest,
	BulkSummary,
	changedTaskIds,
	deleteOutcome,
	restoredInPart,
	summarizeOutcome,
	undoLosses,
	undoRequest
} from '../../models/bulk-undo';
import { isMove, moveItem, orderAfterDrop } from '../../models/manual-order';
import { appendRows, groupRows, nextFocus, visibleOrder } from '../../models/row-groups';
import {
	EMPTY_SELECTION,
	retainSelection,
	selectAllOnPage,
	selectRange,
	TaskSelection,
	toggleSelection,
	unselectPage
} from '../../models/selection';
import { conflictOf, isViewGone, overwriteInput, TaskViewConflict } from '../../models/view-conflict';
import {
	BUILT_IN_VIEWS,
	createInput,
	DEFAULT_DEFINITION,
	definitionOf,
	groupViews,
	isBuiltInViewKey,
	isPropertyShown,
	isSameDefinition,
	placementInput,
	ROW_PROPERTIES,
	saveInput,
	scopeOfView,
	TASK_VIEW_GROUPINGS,
	TASK_VIEW_LAYOUTS,
	TASK_VIEW_ORDER_FIELDS,
	TaskViewDefinition,
	TaskViewLayout,
	TaskViewPlacement
} from '../../models/view-definition';
import { ShortcutRegistryService } from '../../keyboard/shortcut-registry.service';
import { browserTimeZone, TaskViewsApiService, TaskViewsScope } from '../../services/task-views-api.service';
import { TaskViewsAvailabilityService, TaskViewsUserScope } from '../../services/task-views-availability.service';
import {
	EMPTY_OPTIONS,
	humanize,
	TaskViewOptions,
	TaskViewsOptionsService
} from '../../services/task-views-options.service';
import { BulkApply, BulkPicker, BulkToolbarComponent } from '../bulk-toolbar/bulk-toolbar.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { FilterEditorComponent } from '../filter-editor/filter-editor.component';
import { GoToTaskBoxComponent } from '../go-to-task/go-to-task-box.component';
import {
	SaveViewDialogComponent,
	SaveViewDialogMode,
	SaveViewDialogResult
} from '../save-view-dialog/save-view-dialog.component';
import { RowDrop, RowToggle, TaskListComponent } from '../task-list/task-list.component';
import { TimelineComponent } from '../timeline/timeline.component';

/** The view the page shows: one the platform computes, or a saved one. */
export type ViewRef = { kind: 'built-in'; key: TaskBuiltInViewEnum } | { kind: 'saved'; id: ID };

/** The i18n key of a built-in view's name (`this-week` → `TASK_VIEWS.BUILT_IN.THIS_WEEK`). */
export function builtInKey(key: string): string {
	return `TASK_VIEWS.BUILT_IN.${key.replace(/-/g, '_').toUpperCase()}`;
}

/** The i18n key of a grouping, an ordering field. */
export const groupingKey = (groupBy: string) => `TASK_VIEWS.GROUP.${groupBy.toUpperCase()}`;
export const orderFieldKey = (field: string) =>
	`TASK_VIEWS.ORDER.${field.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
export const propertyKey = (property: string) =>
	`TASK_VIEWS.LIST.COLUMNS.${property.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;

/** The undo the page offers after a bulk change, until it runs out. */
interface PendingUndo {
	messageKey: string;
	params: Record<string, unknown>;
	request: ITaskBulkUpdateInput | null;
	/** Tasks the undo puts back only in part (an old status, priority or size name the platform does not take). */
	lossy: readonly ID[];
}

/** How long an edit of the filter waits before the tasks are read again. */
const FILTER_DEBOUNCE_MS = 350;

/**
 * The task views page (`/pages/task-views`): the views switcher (the built-in views, then mine, the team's, the
 * projects' and the organization's saved views), the open view's tasks with its filter tree, grouping (with the
 * platform's counts) and ordering, cursor paging, manual order by drag and drop, multi-select with the bulk toolbar
 * and its undo, and the list's keyboard commands. Saves state the version they read: a stale one shows the conflict
 * with Reload and Overwrite.
 */
@Component({
	selector: 'ngx-task-views-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		RouterLink,
		RouterLinkActive,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe,
		BulkToolbarComponent,
		FilterEditorComponent,
		GoToTaskBoxComponent,
		TaskListComponent,
		TimelineComponent
	],
	templateUrl: './task-views-page.component.html',
	styleUrl: './task-views-page.component.scss'
})
export class TaskViewsPageComponent implements OnInit {
	private readonly api = inject(TaskViewsApiService);
	private readonly optionsService = inject(TaskViewsOptionsService);
	private readonly availability = inject(TaskViewsAvailabilityService);
	private readonly store = inject(Store);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly dialogs = inject(NbDialogService);
	private readonly toastr = inject(ToastrService);
	private readonly registry = inject(ShortcutRegistryService);
	private readonly destroyRef = inject(DestroyRef);

	@ViewChild(BulkToolbarComponent) private toolbar?: BulkToolbarComponent;

	protected readonly link = TASK_VIEWS_LINK;
	protected readonly builtInSegment = TASK_VIEWS_BUILT_IN_SEGMENT;
	protected readonly builtInViews = BUILT_IN_VIEWS;
	protected readonly groupings = TASK_VIEW_GROUPINGS;
	protected readonly layouts = TASK_VIEW_LAYOUTS;
	protected readonly orderFields = TASK_VIEW_ORDER_FIELDS;
	protected readonly properties = Object.keys(ROW_PROPERTIES);
	protected readonly selectionLimit = TASK_SELECTION_LIMIT;
	protected readonly builtInKey = builtInKey;
	protected readonly groupingKey = groupingKey;
	protected readonly orderFieldKey = orderFieldKey;
	protected readonly propertyKey = propertyKey;

	/** `null` while the platform is being asked whether it serves the views. */
	protected readonly available = toSignal(this.availability.available$, { initialValue: null as boolean | null });

	protected readonly scope = signal<TaskViewsScope | null>(null);
	protected readonly options = signal<TaskViewOptions>(EMPTY_OPTIONS);
	protected readonly views = signal<ITaskView[]>([]);
	protected readonly viewSearch = signal('');
	protected readonly current = signal<ViewRef>({ kind: 'built-in', key: TaskBuiltInViewEnum.MINE });
	protected readonly savedView = signal<ITaskView | null>(null);
	protected readonly draft = signal<TaskViewDefinition>({ ...DEFAULT_DEFINITION, properties: {} });

	protected readonly items = signal<ITask[]>([]);
	protected readonly total = signal(0);
	protected readonly nextCursor = signal<string | null>(null);
	protected readonly counts = signal<ITaskViewGroupCount[] | null>(null);
	protected readonly countedBy = signal<TaskViewGroupBy>('none');
	protected readonly invalid = signal<Map<string, ITaskViewInvalidFilter[]>>(new Map());
	protected readonly loading = signal(false);
	protected readonly loadingMore = signal(false);
	protected readonly error = signal(false);
	protected readonly gone = signal(false);

	protected readonly conflict = signal<TaskViewConflict | null>(null);
	protected readonly saving = signal(false);
	protected readonly selection = signal<TaskSelection>(EMPTY_SELECTION);
	protected readonly focusedId = signal<ID | null>(null);
	protected readonly busy = signal(false);
	protected readonly undo = signal<PendingUndo | null>(null);
	protected readonly filtersOpen = signal(true);

	/** The signed-in user's permissions as the store holds them: the checks below follow it when it loads or changes. */
	private readonly rolePermissions = toSignal(
		(this.store.userRolePermissions$ as Observable<unknown> | undefined) ?? of(null),
		{ initialValue: null }
	);
	protected readonly canAdd = computed(() =>
		this.permitted(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	);
	protected readonly canEdit = computed(() =>
		this.permitted(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	);
	protected readonly canDeleteTasks = computed(() =>
		this.permitted(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	);

	protected readonly isSaved = computed(() => this.current().kind === 'saved');
	/** A saved view drawn as a timeline (a built-in view is always the list). */
	protected readonly isTimeline = computed(() => this.isSaved() && this.draft().layout === 'timeline');
	protected readonly savedDefinition = computed(() => definitionOf(this.savedView()));
	protected readonly dirty = computed(
		() => this.isSaved() && !!this.savedView() && !isSameDefinition(this.draft(), this.savedDefinition())
	);
	/** The ordering applies once saved: the platform reads a view's own ordering. */
	protected readonly orderingPending = computed(() => {
		const saved = this.savedDefinition().orderBy;
		const draft = this.draft().orderBy;
		return this.isSaved() && (saved.field !== draft.field || saved.direction !== draft.direction);
	});
	protected readonly groupedViews = computed(() => {
		const words = this.viewSearch().trim().toLowerCase().split(/\s+/).filter(Boolean);
		const views = words.length
			? this.views().filter((view) => words.every((word) => (view.name ?? '').toLowerCase().includes(word)))
			: this.views();
		return groupViews(views);
	});
	protected readonly rowGroups = computed(() =>
		groupRows(
			this.items(),
			this.isSaved() ? this.countedBy() : 'none',
			this.isSaved() ? this.counts() : null,
			(key) => this.groupLabel(key)
		)
	);
	protected readonly order = computed(() => visibleOrder(this.rowGroups()));
	protected readonly shownProperties = computed(() => {
		const definition = this.draft();
		return Object.fromEntries(this.properties.map((property) => [property, isPropertyShown(definition, property)]));
	});
	/** Drag and drop orders a saved view ordered by hand, ungrouped and unfiltered beyond what it saved. */
	protected readonly draggable = computed(() => {
		const view = this.savedView();
		if (!view || !this.isSaved() || !this.canEdit()) return false;
		const saved = this.savedDefinition();
		const draft = this.draft();
		return (
			draft.layout === 'list' &&
			saved.orderBy.field === 'manual' &&
			draft.orderBy.field === 'manual' &&
			draft.groupBy === 'none' &&
			JSON.stringify(saved.filter ?? null) === JSON.stringify(draft.filter ?? null)
		);
	});
	protected readonly hasMore = computed(() =>
		this.isSaved() ? !!this.nextCursor() : this.items().length < this.total()
	);
	protected readonly filterCount = computed(() => conditionsOf(this.draft().filter).length);
	protected readonly title = computed(() => {
		const current = this.current();
		return current.kind === 'saved' ? (this.savedView()?.name ?? '') : '';
	});
	protected readonly viewScope = computed(() => {
		const view = this.savedView();
		return view ? scopeOfView(view) : null;
	});

	private generation = 0;
	/** Bumped each time a view is opened: a write answers for the opening it was sent from, not a later one. */
	private opening = 0;
	/** Bumped at each read of the switcher's list: only the latest read is shown. */
	private viewsRead = 0;
	/** The latest opening of a view (its read and its rows): a write's refresh waits for it. */
	private openingTask: Promise<void> = Promise.resolve();
	private lastSent: ApplicableTree | null = null;
	private filterTimer: ReturnType<typeof setTimeout> | null = null;
	private undoTimer: ReturnType<typeof setTimeout> | null = null;

	ngOnInit(): void {
		// The route first: the view to open is known before the scope opens it.
		this.route.paramMap
			.pipe(
				map((params) => this.refOf(params.get('key'), params.get('viewId'))),
				distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((ref) => {
				this.current.set(ref);
				if (this.scope()) void this.open(ref);
			});

		const scope$ = combineLatest([this.availability.available$, this.availability.scope$]).pipe(
			filter(([available, scope]) => available && !!scope),
			map(([, scope]) => scope as TaskViewsUserScope),
			// Another user (signed in without a reload) is another scope too: the option lists are read for them.
			distinctUntilChanged(
				(a, b) => a.userId === b.userId && a.organizationId === b.organizationId && a.tenantId === b.tenantId
			),
			takeUntilDestroyed(this.destroyRef)
		);
		scope$.subscribe((scope) => {
			this.scope.set({
				organizationId: scope.organizationId,
				...(scope.tenantId ? { tenantId: scope.tenantId } : {})
			});
			this.options.set(EMPTY_OPTIONS);
			// Nothing of the previous scope stays: its views in the switcher, an undo of its tasks.
			this.views.set([]);
			this.clearUndo();
			void this.loadViews();
			void this.open(this.current());
		});
		// The organization's records the editor and the toolbar pick from: those of the scope shown, read once each.
		scope$
			.pipe(
				switchMap((scope) => this.optionsService.options(scope)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((options) => this.options.set(options));

		this.api.changed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((kind) => {
			if (kind === 'views') void this.loadViews();
		});

		this.registerShortcuts();
		this.destroyRef.onDestroy(() => {
			if (this.filterTimer) clearTimeout(this.filterTimer);
			if (this.undoTimer) clearTimeout(this.undoTimer);
		});
	}

	// ---------------------------------------------------------------- opening a view

	private refOf(key: string | null, viewId: string | null): ViewRef {
		if (viewId) return { kind: 'saved', id: viewId as ID };
		return { kind: 'built-in', key: isBuiltInViewKey(key) ? key : TaskBuiltInViewEnum.MINE };
	}

	protected linkOf(ref: ViewRef): string[] {
		return ref.kind === 'saved'
			? [TASK_VIEWS_LINK, String(ref.id)]
			: [TASK_VIEWS_LINK, TASK_VIEWS_BUILT_IN_SEGMENT, ref.key];
	}

	private open(ref: ViewRef): Promise<void> {
		const task = this.openView(ref);
		this.openingTask = task.catch(() => undefined);
		return task;
	}

	private async openView(ref: ViewRef): Promise<void> {
		const scope = this.scope();
		if (!scope) return;
		const opening = ++this.opening;
		// An edit of the view left that was still to be read applies to it, not to the view opened now.
		if (this.filterTimer) {
			clearTimeout(this.filterTimer);
			this.filterTimer = null;
		}
		this.selection.set(EMPTY_SELECTION);
		this.focusedId.set(null);
		this.conflict.set(null);
		this.gone.set(false);
		this.invalid.set(new Map());
		this.lastSent = null;
		this.toolbar?.closePicker();
		if (ref.kind === 'built-in') {
			this.savedView.set(null);
			this.draft.set({ ...DEFAULT_DEFINITION, properties: {} });
			await this.reload();
			return;
		}
		this.generation += 1;
		this.loadingMore.set(false);
		// The view left is not the page's any more while the next one loads: nothing saves it (or its draft) meanwhile.
		this.savedView.set(null);
		this.draft.set({ ...DEFAULT_DEFINITION, properties: {} });
		this.loading.set(true);
		try {
			const view = await firstValueFrom(this.api.getView(ref.id, scope));
			// Only another opening supersedes this one: a read of the rows meanwhile does not (it is read again below).
			if (opening !== this.opening) return;
			this.savedView.set(view);
			this.draft.set(definitionOf(view));
			await this.reload();
		} catch (error) {
			if (opening !== this.opening) return;
			this.loading.set(false);
			this.savedView.set(null);
			this.items.set([]);
			this.total.set(0);
			if (isViewGone(error)) this.gone.set(true);
			else this.error.set(true);
		}
	}

	/**
	 * The error's Try again: a saved view that could not be read is opened again (its rows alone would be read
	 * without its filter); otherwise its rows are read again.
	 */
	protected retry(): void {
		if (this.isSaved() && !this.savedView()) void this.open(this.current());
		else void this.reload();
	}

	/** Reads the first page of the open view again (after an edit of the filter, a bulk change, a reload). */
	protected async reload(): Promise<void> {
		const scope = this.scope();
		if (!scope) return;
		// A saved view that is not open (still being read, or its read failed) has no definition to read its rows
		// by: its opening reads them, and Try again opens it again (its error stays until then).
		if (this.isSaved() && !this.savedView()) return;
		const generation = ++this.generation;
		// A Load more of the rows read before is superseded: its answer is dropped, and the button is free again.
		this.loadingMore.set(false);
		this.loading.set(true);
		this.error.set(false);
		try {
			const page = await this.fetchPage(scope, null);
			if (generation !== this.generation) return;
			this.applyPage(page, true);
		} catch (error) {
			if (generation !== this.generation) return;
			if (isViewGone(error) && this.isSaved()) this.gone.set(true);
			else this.error.set(true);
		} finally {
			if (generation === this.generation) this.loading.set(false);
		}
	}

	protected async loadMore(): Promise<void> {
		const scope = this.scope();
		// Not while the rows are read anew: the cursor shown is the previous read's.
		if (!scope || this.loading() || this.loadingMore() || !this.hasMore()) return;
		const generation = this.generation;
		this.loadingMore.set(true);
		try {
			const page = await this.fetchPage(scope, this.isSaved() ? this.nextCursor() : String(this.items().length));
			if (generation !== this.generation) return;
			this.applyPage(page, false);
		} catch {
			if (generation === this.generation) this.toastr.danger('TASK_VIEWS.ERROR');
		} finally {
			// A superseded request leaves the flag to the rows read since (and to a Load more of theirs).
			if (generation === this.generation) this.loadingMore.set(false);
		}
	}

	private async fetchPage(
		scope: TaskViewsScope,
		cursor: string | null
	): Promise<{
		items: ITask[];
		total: number;
		nextCursor: string | null;
		groups?: ITaskViewGroupCount[] | null;
		groupBy?: TaskViewGroupBy;
		invalid?: ITaskViewInvalidFilter[];
	}> {
		const current = this.current();
		const timeZone = (this.store.user as IUser | undefined)?.timeZone || browserTimeZone();
		if (current.kind === 'built-in') {
			const skip = cursor ? Number(cursor) || 0 : 0;
			const page: IPagination<ITask> = await firstValueFrom(
				this.api.builtIn(current.key, scope, skip, TASK_VIEWS_PAGE_SIZE, timeZone)
			);
			const items = page.items ?? [];
			return { items, total: page.total ?? items.length, nextCursor: null };
		}
		const sent = applicableTree(this.draft().filter);
		this.lastSent = sent;
		const page: ITaskViewTasksPage = await firstValueFrom(
			this.api.viewTasks(current.id, scope, {
				cursor,
				groupBy: this.draft().groupBy,
				filter: sent.tree ?? ({ op: 'and', conditions: [] } as ITaskViewFilterGroup),
				timeZone
			})
		);
		return {
			items: page.items ?? [],
			total: page.total ?? 0,
			nextCursor: page.nextCursor ?? null,
			groups: page.groups,
			groupBy: page.groupBy,
			invalid: page.invalidFilters
		};
	}

	private applyPage(
		page: {
			items: ITask[];
			total: number;
			nextCursor: string | null;
			groups?: ITaskViewGroupCount[] | null;
			groupBy?: TaskViewGroupBy;
			invalid?: ITaskViewInvalidFilter[];
		},
		replace: boolean
	): void {
		const items = replace ? page.items : appendRows(this.items(), page.items);
		this.items.set(items);
		this.total.set(page.total);
		this.nextCursor.set(page.nextCursor);
		// Only a read of every row can say a selected task is gone: a first page alone (or one read again) says
		// nothing about the rows after it, while the last page appended completes the read.
		if (!this.isMoreAfter(page, items.length)) {
			this.selection.update((selection) =>
				retainSelection(
					selection,
					items.map((row) => row.id as ID)
				)
			);
		}
		if (replace) {
			this.counts.set(page.groups ?? null);
			this.countedBy.set(page.groupBy ?? 'none');
			this.invalid.set(invalidByPath(page.invalid ?? [], this.lastSent));
			const focused = this.focusedId();
			if (focused && !items.some((row) => row.id === focused)) this.focusedId.set(null);
		}
	}

	/** Whether rows of the view lie beyond the ones read (a next cursor, or fewer rows than the total). */
	private isMoreAfter(page: { nextCursor: string | null; total: number }, read: number): boolean {
		return this.isSaved() ? !!page.nextCursor : read < page.total;
	}

	private groupLabel(key: string): string {
		if (!key) return '';
		const options = this.options();
		const lists: Record<string, keyof TaskViewOptions> = {
			status: 'status',
			priority: 'priority',
			size: 'size',
			project: 'project',
			sprint: 'sprint',
			assignee: 'assignees',
			team: 'team',
			label: 'labels'
		};
		const list = options[lists[this.countedBy()] ?? 'status'] ?? [];
		return humanize(list.find((option) => option.id === key)?.label ?? '');
	}

	// ---------------------------------------------------------------- the switcher

	private async loadViews(): Promise<void> {
		const scope = this.scope();
		if (!scope) return;
		const read = ++this.viewsRead;
		const views: ITaskView[] = [];
		try {
			for (let skip = 0; skip < SAVED_VIEWS_MAX;) {
				const page = await firstValueFrom(this.api.listViews(scope, skip, SAVED_VIEWS_PAGE_SIZE));
				// A later read (another scope, or the list changed again) answers for the switcher instead.
				if (read !== this.viewsRead || scope !== this.scope()) return;
				views.push(...(page.items ?? []));
				skip += page.items?.length ?? 0;
				if (!page.items?.length || skip >= (page.total ?? 0)) break;
			}
			this.views.set(views);
		} catch {
			// The switcher keeps what it listed for this scope (a new scope starts empty); the open view is unaffected.
		}
	}

	// ---------------------------------------------------------------- editing the view

	protected setFilter(tree: ITaskViewFilterGroup | null): void {
		this.draft.update((draft) => ({ ...draft, filter: tree }));
		if (this.filterTimer) clearTimeout(this.filterTimer);
		this.filterTimer = setTimeout(() => void this.reload(), FILTER_DEBOUNCE_MS);
	}

	/** The layout is the view's: shown at once, saved with the view. */
	protected setLayout(layout: TaskViewLayout): void {
		this.draft.update((draft) => ({ ...draft, layout }));
		// The timeline shows no focused row; a selection stays, for the bulk toolbar.
		if (layout === 'timeline') this.focusedId.set(null);
	}

	protected setGroupBy(groupBy: TaskViewGroupBy): void {
		this.draft.update((draft) => ({ ...draft, groupBy }));
		void this.reload();
	}

	protected setOrderField(field: TaskViewOrderField): void {
		this.draft.update((draft) => ({
			...draft,
			orderBy: { field, direction: field === 'dueDate' || field === 'title' ? 'asc' : 'desc' }
		}));
	}

	protected toggleDirection(): void {
		this.draft.update((draft) => ({
			...draft,
			orderBy: { ...draft.orderBy, direction: draft.orderBy.direction === 'asc' ? 'desc' : 'asc' }
		}));
	}

	protected toggleProperty(property: string): void {
		this.draft.update((draft) => ({
			...draft,
			properties: { ...draft.properties, [property]: !isPropertyShown(draft, property) }
		}));
	}

	protected discard(): void {
		this.draft.set(this.savedDefinition());
		void this.reload();
	}

	/** Saves the edit of the open view, stating the version it was read at. */
	protected async save(): Promise<void> {
		const view = this.savedView();
		const scope = this.scope();
		if (!view || !scope || !this.canEdit() || this.saving()) return;
		await this.sendUpdate(view.id as ID, saveInput(view, this.draft(), scope), 'save');
	}

	private async sendUpdate(id: ID, input: ITaskViewUpdateInput, kind: 'save' | 'placement'): Promise<void> {
		const opening = this.opening;
		this.saving.set(true);
		try {
			const saved = await firstValueFrom(this.api.updateView(id, input));
			this.api.notify('views');
			this.toastr.success('TASK_VIEWS.VIEW.SAVED');
			// Another view opened meanwhile: the answer is that view's no more (the page shows the one opened).
			if (!this.isOpen(id, opening)) return;
			this.conflict.set(null);
			this.savedView.set(saved);
			// The ordering is the view's own: a saved new one changes the rows.
			if (kind === 'save') void this.reload();
		} catch (error) {
			const conflict = conflictOf(error, input, kind);
			if (conflict && this.isOpen(id, opening)) this.conflict.set(conflict);
			else if (!conflict) this.toastr.danger(this.errorMessage(error, 'TASK_VIEWS.VIEW.SAVE_FAILED'));
		} finally {
			this.saving.set(false);
		}
	}

	/**
	 * Whether the saved view a write was for is still the one the page shows, in the same opening: a view left and
	 * opened again is another opening (it read its own version), so a late answer to the first one is not applied.
	 */
	private isOpen(id: ID, opening: number): boolean {
		const current = this.current();
		return opening === this.opening && current.kind === 'saved' && current.id === id && this.savedView()?.id === id;
	}

	/** Conflict → Reload: the latest view replaces the edit. */
	protected reloadLatest(): void {
		const conflict = this.conflict();
		if (!conflict) return;
		this.conflict.set(null);
		this.savedView.set(conflict.latest);
		this.draft.set(definitionOf(conflict.latest));
		void this.reload();
	}

	/** Conflict → Overwrite: the same save on the latest version. */
	protected async overwrite(): Promise<void> {
		const conflict = this.conflict();
		const view = this.savedView();
		if (!conflict || !view) return;
		const input = overwriteInput(conflict);
		// The latest view as read (its columns and its version together): a failed overwrite leaves nothing stale
		// that a later save could write over another client's change. The draft keeps the edit.
		this.savedView.set(conflict.latest);
		if (conflict.kind === 'order') {
			// The rows shown are the latest order (read again on the conflict): once the attempted one is saved, they
			// are read in it, so a next drag starts from what was saved.
			if (await this.sendOrder(view.id as ID, input as ITaskViewOrderInput)) void this.reload();
		} else {
			// The latest view's own keys of `filterOptions` (another client's) are kept: the save is rebuilt on it.
			const scope = this.scope();
			const rebuilt =
				conflict.kind === 'save' && scope
					? saveInput(conflict.latest, this.draft(), scope)
					: (input as ITaskViewUpdateInput);
			await this.sendUpdate(view.id as ID, rebuilt, conflict.kind);
		}
	}

	protected dismissConflict(): void {
		this.conflict.set(null);
	}

	protected async newView(mode: SaveViewDialogMode = 'create'): Promise<void> {
		const scope = this.scope();
		if (!scope || !this.canAdd()) return;
		const view = this.savedView();
		const placement = await this.askPlacement(
			mode,
			mode === 'saveAs' && view ? { name: view.name, visibility: TaskViewVisibilityEnum.PERSONAL } : null
		);
		if (!placement) return;
		const definition = mode === 'saveAs' ? this.draft() : { ...DEFAULT_DEFINITION, properties: {} };
		this.saving.set(true);
		try {
			const created = await firstValueFrom(
				this.api.createView(createInput(definition, placement, scope, mode === 'saveAs' ? view : null))
			);
			this.api.notify('views');
			this.toastr.success('TASK_VIEWS.VIEW.CREATED');
			await this.router.navigate([TASK_VIEWS_LINK, String(created.id)]);
		} catch (error) {
			this.toastr.danger(this.errorMessage(error, 'TASK_VIEWS.VIEW.SAVE_FAILED'));
		} finally {
			this.saving.set(false);
		}
	}

	protected async rename(): Promise<void> {
		const view = this.savedView();
		const scope = this.scope();
		if (!view || !scope || !this.canEdit()) return;
		const placement = await this.askPlacement('rename', {
			name: view.name,
			visibility: view.visibility ?? TaskViewVisibilityEnum.SHARED,
			organizationTeamId: view.organizationTeamId ?? null,
			projectId: view.projectId ?? null
		});
		if (!placement) return;
		await this.sendUpdate(view.id as ID, placementInput(view, placement, scope), 'placement');
	}

	protected async toggleVisibility(): Promise<void> {
		const view = this.savedView();
		const scope = this.scope();
		if (!view || !scope || !this.canEdit()) return;
		const visibility =
			view.visibility === TaskViewVisibilityEnum.PERSONAL
				? TaskViewVisibilityEnum.SHARED
				: TaskViewVisibilityEnum.PERSONAL;
		await this.sendUpdate(view.id as ID, placementInput(view, { visibility }, scope), 'placement');
	}

	protected async deleteView(): Promise<void> {
		const view = this.savedView();
		if (!view || !this.canEdit()) return;
		const confirmed = await this.confirm(
			'TASK_VIEWS.VIEW.DELETE_CONFIRM',
			{ name: view.name },
			'TASK_VIEWS.VIEW.DELETE'
		);
		if (!confirmed) return;
		try {
			await firstValueFrom(this.api.deleteView(view.id as ID));
			this.api.notify('views');
			this.toastr.success('TASK_VIEWS.VIEW.DELETED');
			await this.router.navigate([TASK_VIEWS_LINK, TASK_VIEWS_BUILT_IN_SEGMENT, TaskBuiltInViewEnum.MINE]);
		} catch (error) {
			this.toastr.danger(this.errorMessage(error, 'TASK_VIEWS.VIEW.DELETE_FAILED'));
		}
	}

	private async askPlacement(
		mode: SaveViewDialogMode,
		initial: Partial<TaskViewPlacement> | null
	): Promise<TaskViewPlacement | null> {
		const ref = this.dialogs.open(SaveViewDialogComponent, {
			context: { mode, initial, teams: this.options().team, projects: this.options().project },
			closeOnBackdropClick: false
		});
		const result = (await firstValueFrom(ref.onClose)) as SaveViewDialogResult;
		return result ?? null;
	}

	private async confirm(messageKey: string, params: Record<string, unknown>, confirmKey: string): Promise<boolean> {
		const ref = this.dialogs.open(ConfirmDialogComponent, {
			context: { messageKey, params, confirmKey, danger: true }
		});
		return (await firstValueFrom(ref.onClose)) === true;
	}

	// ---------------------------------------------------------------- manual order

	protected async drop(event: RowDrop): Promise<void> {
		const view = this.savedView();
		const scope = this.scope();
		if (!view || !scope || !this.draggable()) return;
		const rows = this.items();
		if (!isMove(event.from, event.to, rows.length)) return;
		const moved = moveItem(rows, event.from, event.to);
		this.items.set(moved);
		const taskIds = orderAfterDrop(
			view.manualOrder ?? [],
			moved.map((row) => row.id as ID),
			TASK_VIEW_ORDER_MAX
		);
		await this.sendOrder(view.id as ID, { ...scope, taskIds, expectedVersion: view.version ?? 1 });
	}

	/** Saves a manual order; `true` when it was saved for the view still open. */
	private async sendOrder(id: ID, input: ITaskViewOrderInput): Promise<boolean> {
		const opening = this.opening;
		this.saving.set(true);
		try {
			const saved = await firstValueFrom(this.api.setOrder(id, input));
			if (!this.isOpen(id, opening)) return false;
			this.conflict.set(null);
			this.savedView.set(saved);
			return true;
		} catch (error) {
			const conflict = conflictOf(error, input, 'order');
			if (!conflict) this.toastr.danger(this.errorMessage(error, 'TASK_VIEWS.ORDER.FAILED'));
			if (!this.isOpen(id, opening)) return false;
			if (conflict) this.conflict.set(conflict);
			void this.reload();
			return false;
		} finally {
			this.saving.set(false);
		}
	}

	// ---------------------------------------------------------------- selection

	protected onToggle(event: RowToggle): void {
		const change = event.shift
			? selectRange(this.selection(), this.order(), event.id, TASK_SELECTION_LIMIT)
			: toggleSelection(this.selection(), event.id, TASK_SELECTION_LIMIT);
		this.selection.set(change.selection);
		this.focusedId.set(event.id);
		if (change.limited) this.toastr.warning('TASK_VIEWS.BULK.LIMIT', { limit: TASK_SELECTION_LIMIT });
	}

	protected onPageToggle(select: boolean): void {
		if (!select) {
			this.selection.set(unselectPage(this.selection(), this.order()));
			return;
		}
		const change = selectAllOnPage(this.selection(), this.order(), TASK_SELECTION_LIMIT);
		this.selection.set(change.selection);
		if (change.limited) this.toastr.warning('TASK_VIEWS.BULK.LIMIT', { limit: TASK_SELECTION_LIMIT });
	}

	protected clearSelection(): void {
		this.selection.set(EMPTY_SELECTION);
		this.toolbar?.closePicker();
	}

	protected openTask(id: ID): void {
		void this.router.navigate([TASK_PAGE_LINK, id]);
	}

	// ---------------------------------------------------------------- bulk actions

	protected async applyBulk(apply: BulkApply): Promise<void> {
		const scope = this.scope();
		if (!scope || this.busy()) return;
		const built = bulkRequest(this.selection().ids, apply.changes, scope, TASK_SELECTION_LIMIT);
		if ('refusal' in built) {
			if (built.refusal === 'limit')
				this.toastr.warning('TASK_VIEWS.BULK.LIMIT', { limit: TASK_SELECTION_LIMIT });
			return;
		}
		this.busy.set(true);
		let wrote = false;
		try {
			const outcome = await firstValueFrom(this.api.bulkUpdate(built.request));
			wrote = true;
			const summary = summarizeOutcome(outcome);
			// Another organization opened meanwhile: its page offers no undo of this one's tasks.
			if (this.scope() === scope)
				this.offerUndo(
					this.summaryMessage(summary),
					{ ...this.summaryParams(summary), action: apply.action },
					undoRequest(outcome, scope),
					undoLosses(outcome)
				);
			if (summary.refused)
				this.toastr.warning('TASK_VIEWS.BULK.REFUSED', {
					count: summary.refused,
					errors: this.refusalText(summary)
				});
			if (changedTaskIds(outcome).length) this.api.notify('tasks');
		} catch (error) {
			this.toastr.danger(this.errorMessage(error, 'TASK_VIEWS.BULK.FAILED'));
		} finally {
			this.busy.set(false);
		}
		if (wrote) await this.refreshAfterWrite(scope);
	}

	/**
	 * Sends the undo. The bar stays until the undo answered (its button waits meanwhile): a failed undo can be tried
	 * again while its time lasts, over rows read again first. The undo sets each task's previous values, so a second
	 * try after a part of the first went through changes nothing more.
	 */
	protected async undoLast(): Promise<void> {
		const pending = this.undo();
		const scope = this.scope();
		if (!pending?.request || !scope || this.busy()) return;
		this.busy.set(true);
		try {
			const outcome = await firstValueFrom(this.api.bulkUpdate(pending.request));
			if (this.undo() === pending) this.clearUndo();
			const summary = summarizeOutcome(outcome);
			if (summary.refused)
				this.toastr.warning('TASK_VIEWS.BULK.UNDO_PARTIAL', {
					applied: summary.applied,
					refused: summary.refused
				});
			else this.toastr.success('TASK_VIEWS.BULK.UNDONE');
			// Only the tasks the undo did change: a refused one was not put back at all (the warning above says so).
			const lossy = restoredInPart(pending.lossy, outcome);
			if (lossy) this.toastr.warning('TASK_VIEWS.BULK.UNDO_LOSSY', { count: lossy });
			this.api.notify('tasks');
		} catch (error) {
			this.toastr.danger(this.errorMessage(error, 'TASK_VIEWS.BULK.UNDO_FAILED'));
		} finally {
			this.busy.set(false);
		}
		// Done or failed (a part may have gone through), the rows are read again.
		await this.refreshAfterWrite(scope);
	}

	protected async deleteSelected(): Promise<void> {
		const ids = [...this.selection().ids];
		const scope = this.scope();
		if (!ids.length || !scope || this.busy()) return;
		const opening = this.opening;
		const confirmed = await this.confirm(
			'TASK_VIEWS.BULK.DELETE_CONFIRM',
			{ count: ids.length },
			'TASK_VIEWS.BULK.DELETE'
		);
		// Another view (or organization) opened while the question was shown: its selection is not the one counted.
		if (!confirmed || opening !== this.opening) return;
		this.busy.set(true);
		const results: Array<{ taskId: ID; ok: boolean; error?: string }> = [];
		try {
			for (let at = 0; at < ids.length; at += BULK_DELETE_CONCURRENCY) {
				const batch = ids.slice(at, at + BULK_DELETE_CONCURRENCY);
				results.push(
					...(await Promise.all(
						batch.map((taskId) =>
							firstValueFrom(this.api.deleteTask(taskId)).then(
								() => ({ taskId, ok: true }),
								(error: unknown) => ({ taskId, ok: false, error: this.errorText(error) })
							)
						)
					))
				);
			}
			const summary = deleteOutcome(results);
			const deleted = new Set(results.filter((result) => result.ok).map((result) => result.taskId));
			this.selection.update((selection) =>
				retainSelection(
					selection,
					selection.ids.filter((id) => !deleted.has(id))
				)
			);
			// The platform decides per task (without a delete permission, only a manager of one of the task's teams
			// may delete it): the refused tasks are named with its reason.
			if (summary.refused)
				this.toastr.warning('TASK_VIEWS.BULK.DELETE_PARTIAL', {
					applied: summary.applied,
					refused: summary.refused,
					errors: this.refusalText(summary)
				});
			else this.toastr.success('TASK_VIEWS.BULK.DELETED', { count: summary.applied });
			this.api.notify('tasks');
		} finally {
			this.busy.set(false);
		}
		await this.refreshAfterWrite(scope);
	}

	/**
	 * Reads the rows again after a write, in the organization it was made in. A view opening meanwhile is waited
	 * for first (the latest one, if several): its rows may have been read before the write ended, and a read during
	 * its opening would only be superseded by the opening's own.
	 */
	private async refreshAfterWrite(scope: TaskViewsScope): Promise<void> {
		let opened: Promise<void> | null = null;
		while (opened !== this.openingTask) {
			opened = this.openingTask;
			await opened;
		}
		if (this.scope() === scope) await this.reload();
	}

	private offerUndo(
		messageKey: string,
		params: Record<string, unknown>,
		request: ITaskBulkUpdateInput | null,
		lossy: readonly ID[] = []
	): void {
		this.clearUndo();
		this.undo.set({ messageKey, params, request, lossy });
		this.undoTimer = setTimeout(() => this.undo.set(null), BULK_UNDO_WINDOW_MS);
	}

	protected clearUndo(): void {
		if (this.undoTimer) clearTimeout(this.undoTimer);
		this.undoTimer = null;
		this.undo.set(null);
	}

	private summaryMessage(summary: BulkSummary): string {
		return summary.refused ? 'TASK_VIEWS.BULK.PARTIAL' : 'TASK_VIEWS.BULK.APPLIED';
	}

	private summaryParams(summary: BulkSummary): Record<string, unknown> {
		return { count: summary.applied, applied: summary.applied, refused: summary.refused };
	}

	/** The refused tasks named by their reference where the page has them. */
	private refusalText(summary: BulkSummary): string {
		const byId = new Map(this.items().map((row) => [String(row.id), row]));
		return summary.refusals
			.slice(0, 3)
			.map((refusal) => {
				const row = byId.get(String(refusal.taskId));
				return `${row?.title ?? refusal.taskId}${refusal.error ? `: ${refusal.error}` : ''}`;
			})
			.join('; ');
	}

	// ---------------------------------------------------------------- the keys of the list

	private registerShortcuts(): void {
		// The timeline shows no focused row: the row keys are the list's, and a task key acts on a selection only.
		const hasRows = () => !this.isTimeline() && this.order().length > 0;
		const focusedRow = () => (this.isTimeline() ? null : this.focusedId());
		const hasTarget = () => this.canEdit() && (this.selection().ids.length > 0 || !!focusedRow());
		const remove = this.registry.registerAll({
			listDown: { run: ({ extend }) => this.moveFocus(1, extend), enabled: hasRows },
			listUp: { run: ({ extend }) => this.moveFocus(-1, extend), enabled: hasRows },
			listSelect: {
				run: ({ extend }) => {
					const id = focusedRow();
					if (id) this.onToggle({ id, shift: extend });
				},
				enabled: () => !!focusedRow()
			},
			listOpen: {
				run: () => {
					const id = focusedRow();
					if (id) this.openTask(id);
				},
				enabled: () => !!focusedRow()
			},
			listClear: {
				run: () => {
					if (this.toolbar?.isPickerOpen) this.toolbar.closePicker(true);
					else this.clearSelection();
				},
				enabled: () => this.selection().ids.length > 0 || !!this.toolbar?.isPickerOpen
			},
			listSaveView: { run: () => void this.save(), enabled: () => this.dirty() && this.canEdit() },
			taskStatus: { run: () => this.openPicker('status'), enabled: hasTarget },
			taskPriority: { run: () => this.openPicker('priority'), enabled: hasTarget },
			taskLabels: { run: () => this.openPicker('labels'), enabled: hasTarget },
			taskDueDate: { run: () => this.openPicker('dueDate'), enabled: hasTarget }
		});
		this.destroyRef.onDestroy(remove);
	}

	private moveFocus(direction: 1 | -1, extend: boolean): void {
		const next = nextFocus(this.order(), this.focusedId(), direction);
		if (!next) return;
		const from = this.focusedId();
		this.focusedId.set(next);
		if (extend) {
			const base =
				from && !this.selection().ids.includes(from)
					? toggleSelection(this.selection(), from, TASK_SELECTION_LIMIT).selection
					: this.selection();
			const change = selectRange(
				base.anchor ? base : { ...base, anchor: from ?? next },
				this.order(),
				next,
				TASK_SELECTION_LIMIT
			);
			this.selection.set(change.selection);
			if (change.limited) this.toastr.warning('TASK_VIEWS.BULK.LIMIT', { limit: TASK_SELECTION_LIMIT });
		}
	}

	private openPicker(picker: BulkPicker): void {
		const focused = this.isTimeline() ? null : this.focusedId();
		if (!this.selection().ids.length && focused) {
			this.selection.set(toggleSelection(EMPTY_SELECTION, focused, TASK_SELECTION_LIMIT).selection);
		}
		// The toolbar shows once something is selected: open its picker after it renders.
		setTimeout(() => this.toolbar?.openPicker(picker));
	}

	/** The help, as `?` opens it (the same dialog, so `?` closes it again). */
	protected openHelp(): void {
		this.registry.invoke('helpOpen');
	}

	// ---------------------------------------------------------------- helpers

	private permitted(...permissions: PermissionsEnum[]): boolean {
		// Read for the dependency: a computed check runs again when the permissions arrive or change.
		this.rolePermissions();
		try {
			return this.store.hasAnyPermission(...permissions);
		} catch {
			return false;
		}
	}

	private errorText(error: unknown): string {
		const response = error as HttpErrorResponse | undefined;
		const body = response?.error as { message?: unknown } | undefined;
		const message = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
		return typeof message === 'string' && message ? message : (response?.message ?? '');
	}

	private errorMessage(error: unknown, fallbackKey: string): string {
		const text = this.errorText(error);
		return text && (error as HttpErrorResponse)?.status && (error as HttpErrorResponse).status < 500
			? text
			: fallbackKey;
	}
}
