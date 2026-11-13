import { ChangeDetectionStrategy, Component, HostBinding, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import * as moment from 'moment-timezone';
import {
	BaseEntityEnum,
	FeatureEnum,
	ID,
	IOrganization,
	IPagination,
	ITask,
	ITaskLinkedIssue,
	ITaskStatus,
	PermissionsEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { API_PREFIX, toParams, toUtcOffset } from '@gauzy/ui-core/common';
import {
	CommentService,
	Store,
	TasksService,
	TimesheetService,
	TimesheetStatisticsService,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { PAGE_EXTENSION_SLOTS } from '@gauzy/plugin-ui';
import {
	AddTaskDialogComponent,
	HashNumberPipe,
	IRecordViewSection,
	IRecordViewStatus,
	RecordViewPageState,
	recordViewPageStateOf,
	TimeZoneService
} from '@gauzy/ui-core/shared';
import { IEmployeeHoursDay } from '../../../employees/view-employee/employee-hours-chart/employee-hours-chart.component';
import {
	failed,
	formatDuration,
	humanize,
	IPersonChip,
	ITaskWorker,
	Loadable,
	loaded,
	loading,
	personOf,
	scopedTaskStatusesOf,
	taskWorkersOf
} from '../../../projects/components/project-view/project-view.utils';
import {
	buildTaskViewSections,
	isTaskFinished,
	taskPriorityOf,
	taskStatusOf,
	TASK_VIEW_RELATIONS
} from './task-view-sections';
import {
	hoursDaysOf,
	ILinkedIssueGroup,
	ITimeEntryRow,
	ITimeTracking,
	linkedIssueGroupsOf,
	newTaskStatusOf,
	timeEntriesOf,
	timeTrackingOf
} from './task-view-page.utils';

/** The relations the page reads: the View's, and the subtasks with what their rows show, as the Board's cards. */
export const TASK_PAGE_RELATIONS: string[] = [
	...TASK_VIEW_RELATIONS,
	'children',
	'children.taskStatus',
	'children.taskPriority',
	'children.members',
	'children.members.user'
];

/**
 * The relations the edit dialog reads, as the task list loads them: the View's and the modules. The dialog saves
 * the modules it was given, so a task read without them would come back with none.
 */
export const TASK_EDIT_RELATIONS: string[] = [...TASK_VIEW_RELATIONS, 'modules'];

/** Days the hours chart covers. */
export const HOURS_DAYS = 14;
/** Days the recent time entries are read over. */
export const ENTRIES_DAYS = 30;

/** The page's tabs, as the project page's; the open one is in the URL (`?tab=`). */
export type TaskViewTab = 'overview' | 'board' | 'activity' | 'comments' | 'documents';

const TABS: TaskViewTab[] = ['overview', 'board', 'activity', 'comments', 'documents'];

/** One subtask, as the Subtasks panel lists it. */
export interface ISubtaskRow {
	id: string;
	key: string;
	title: string;
	status: IRecordViewStatus | null;
	/** Its entry in the status menu, once the statuses are read; none when the menu has no such status. */
	statusId: string | null;
	/** Whether it is in the task's project: the status menu lists that project's statuses, which another may not take. */
	sameProject: boolean;
	priority: IRecordViewStatus | null;
	/** Its assignees. A row with this list keeps the priority and people columns, so the rows line up. */
	people: IPersonChip[];
	done: boolean;
}

/** The subtasks done out of all of them. */
export interface ISubtaskCount {
	done: number;
	total: number;
	/** Done share, 0–100. */
	percent: number;
}

/**
 * A task on its own full-width page, `/pages/tasks/view/:id` (handover §4.P): what a task favorite in the
 * sidebar opens, and where the task drawer's "expand to full width" icon leads. The URL is the task's —
 * bookmark it, share it, reload it.
 *
 * Laid out as Jira's issue page: the actions — the status (with the filters, on the Board), Edit, Copy link and
 * the star — across the top beside the back button, then the breadcrumb and the title; the work in the wide
 * column — the description, the hours
 * per day as Hubstaff charts them, the subtasks and the linked issues; and the facts in the side column — the
 * details, the time tracking with
 * who worked most and the recent time entries, then the stamps.
 *
 * The page belongs to the organization selected in the header, like the task lists: a task of another
 * organization reads "not found" (its favorite star would otherwise file it under the wrong organization),
 * and switching the organization reloads the page, discarding any load still in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-task-view-page',
	templateUrl: './task-view-page.component.html',
	styleUrls: [
		'../../../employees/view-employee/view-employee.component.scss',
		'../../../projects/components/project-quick-look/project-quick-look.component.scss',
		'../../../projects/components/project-view/project-view-page.component.scss',
		'./task-view-page.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TaskViewPageComponent extends TranslationBaseComponent implements OnInit {
	/** The project page's page layout: headline, two columns, then the compact sections. */
	@HostBinding('class.is-page') readonly isPage = true;

	readonly favoriteEntity = BaseEntityEnum.Task;
	/** The slot plugins put their actions on a task's page in (`ActivatedRoute` param `id` is the task). */
	readonly taskActionsSlot = PAGE_EXTENSION_SLOTS.TASK_VIEW_ACTIONS;
	readonly hoursDays = HOURS_DAYS;
	readonly entriesDays = ENTRIES_DAYS;
	readonly tabs: { id: TaskViewTab; label: string; icon: string }[] = [
		{ id: 'overview', label: 'PROJECT_VIEW.TABS.OVERVIEW', icon: 'home-outline' },
		{ id: 'board', label: 'PROJECT_VIEW.TABS.BOARD', icon: 'grid-outline' },
		{ id: 'activity', label: 'PROJECT_VIEW.TABS.ACTIVITY', icon: 'list-outline' },
		{ id: 'comments', label: 'PROJECT_VIEW.TABS.COMMENTS', icon: 'message-square-outline' },
		{ id: 'documents', label: 'PROJECT_VIEW.TABS.DOCUMENTS', icon: 'file-text-outline' }
	];
	tab: TaskViewTab = 'overview';
	/**
	 * The Overview loads when first opened for the task on screen, then stays mounted behind the other tabs: it reads
	 * the time worked and who worked it, the hours per day, the month's time entries and the linked issues, which a page
	 * opened on another tab — the Board, most often — has no use for.
	 */
	overviewOpened = false;
	/**
	 * The Board — the subtasks as the project board — loads when first opened, then stays mounted behind the
	 * Overview: a move still saving when the user leaves it must still reach the Subtasks panel when it lands.
	 */
	boardOpened = false;
	/**
	 * Bumped after a change made from the header — a status move, an edit — so the Board, which shows the task's own
	 * card, reads again. A move made on the Board itself does not bump it: reading the board again would drop the
	 * other cards still saving.
	 */
	boardReloadKey = 0;
	/** Bumped after any change made here — from the header or on the Board — so an open Activity tab reads again. */
	activityReloadKey = 0;

	/** The Comments load when first opened, then stay mounted, so a draft survives a look at another tab. */
	commentsOpened = false;
	/** The task's comments, replies included, on the Comments tab; read with the task, kept by the tab. */
	commentCount = 0;
	/** The Comments tab has counted the comments for this task: its count is newer than the first read. */
	private commentCountFromTab = false;
	/**
	 * Bumped by every full load, not by a refresh: a count read started by an earlier visit — even of the same task —
	 * is discarded, while one still pending through a refresh after a status move is kept.
	 */
	private commentCountSequence = 0;
	/** Entity type the Comments tab hangs its comments off, as the Activity tab reads them. */
	readonly commentEntity = BaseEntityEnum.Task;
	/** The comment the URL points at (`?comment=`, an Inbox notification's link): the Comments tab opens on it. */
	highlightCommentId: ID | null = null;

	/** The Documents load when first opened, then stay mounted, so an upload in flight is not cut off. */
	documentsOpened = false;
	/** The task's attached documents, as the Documents tab last counted them. */
	documentCount = 0;
	/** Entity type the Documents tab attaches its links to. */
	readonly documentEntity = BaseEntityEnum.Task;
	/**
	 * Whether the Documents tab is offered; worked out when the permissions or the feature flags change, not on
	 * every check of the template.
	 */
	canSeeDocuments = false;

	task: ITask = null;
	status: IRecordViewStatus = null;
	/** The description, in the wide column. */
	mainSections: IRecordViewSection[] = [];
	/** The details, at the top of the side column. */
	detailsSections: IRecordViewSection[] = [];
	/** The created / updated stamps, at the foot of the side column. */
	metaSections: IRecordViewSection[] = [];
	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;

	subtasks: ISubtaskRow[] = [];
	subtaskCount: ISubtaskCount | null = null;

	/** The time worked against the estimate, once read. */
	tracking: Loadable<ITimeTracking | null> = loading(null);
	/** The people who worked most on the task, once read. */
	workers: ITaskWorker[] = [];
	hours: Loadable<IEmployeeHoursDay[]> = loading([]);
	entries: Loadable<ITimeEntryRow[]> = loading([]);
	links: Loadable<ILinkedIssueGroup[]> = loading([]);

	/** The statuses the task can move to; read for those who may edit it or add a subtask to it. */
	statuses: ITaskStatus[] = [];
	/** The status menu's entry for the task's status: by its status row, else by its value or name. */
	currentStatusId: string | null = null;
	savingStatus = false;
	/** The subtasks whose status is being saved from their rows. */
	readonly savingSubtasks = new Set<string>();

	readonly canEdit: boolean;
	/**
	 * Whether the project panel links to the project's own page, which has its own guard. Follows the
	 * permissions, which may load after the page is built.
	 */
	canViewProject = false;
	/** Whether the viewer holds the create route's grants. Follows the permissions likewise. */
	canCreateTasks = false;

	private taskId: string = null;
	/** The statuses are being read for the dialog: a second press opens no second one. */
	private openingSubtask = false;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	/**
	 * The sequence of the refresh still reading the task, if any. The Overview opened meanwhile reads nothing itself:
	 * the task on screen is about to be replaced, and the refresh reads the panels for the one that replaces it.
	 */
	private refreshSequence: number | null = null;
	private readonly hashNumberPipe = new HashNumberPipe();

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly http: HttpClient,
		private readonly dialogService: NbDialogService,
		private readonly tasksService: TasksService,
		private readonly timesheetService: TimesheetService,
		private readonly statisticsService: TimesheetStatisticsService,
		private readonly timeZoneService: TimeZoneService,
		private readonly toastrService: ToastrService,
		private readonly commentService: CommentService,
		private readonly store: Store
	) {
		super(translateService);
		this.canEdit = this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT);
	}

	ngOnInit(): void {
		// The component is reused across `view/:id` navigations, and the page follows the header's
		// organization: either changing reloads.
		const id$ = this.route.paramMap.pipe(
			map((params) => params.get('id')),
			filter((id): id is string => !!id),
			distinctUntilChanged()
		);
		const organization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			distinctUntilChanged((a: IOrganization, b: IOrganization) => a.id === b.id)
		);
		combineLatest([id$, organization$])
			.pipe(untilDestroyed(this))
			.subscribe(([id, organization]) => {
				this.taskId = id;
				this.organization = organization;
				void this.load();
			});
		this.store.userRolePermissions$
			.pipe(
				map(() => this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)),
				distinctUntilChanged(),
				untilDestroyed(this)
			)
			.subscribe((canViewProject) => (this.canViewProject = canViewProject));
		this.store.userRolePermissions$
			.pipe(
				map(() => this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)),
				distinctUntilChanged(),
				untilDestroyed(this)
			)
			.subscribe((canCreateTasks) => (this.canCreateTasks = canCreateTasks));
		// The open tab follows the URL, so a tab can be bookmarked, shared and reached with Back. A link that names a
		// comment (`?comment=`, as an Inbox notification's does) opens the Comments tab on it, tab or no tab. It is
		// checked again when the permissions and feature flags land: they arrive after the page, and gate the Documents tab.
		combineLatest([
			this.route.queryParamMap.pipe(
				map((params) => ({ tab: params.get('tab') as TaskViewTab, comment: params.get('comment')?.trim() || null })),
				distinctUntilChanged((a, b) => a.tab === b.tab && a.comment === b.comment)
			),
			this.store.userRolePermissions$,
			this.store.featureOrganizations$,
			this.store.featureTenant$,
			this.store.featureToggles$
		])
			.pipe(untilDestroyed(this))
			.subscribe(([{ tab, comment }]) => {
				this.canSeeDocuments = this.hasDocumentsAccess();
				this.highlightCommentId = comment;
				this.openTab(TABS.includes(tab) && this.canOpenTab(tab) ? tab : comment ? 'comments' : 'overview');
			});
		// The estimate is spelled out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.show());
	}

	/** Loads (or reloads, after an error) the task the URL names. */
	async load(): Promise<void> {
		const id = this.taskId;
		const organizationId = this.organization?.id;
		if (!id || !organizationId) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous task (or organization) stays on screen — nor reachable by the star. Its figures
		// and its project's statuses go too: the menu stays hidden until this task's own statuses arrive.
		this.task = null;
		// Another task's board is not read behind the Overview until its own tab is opened.
		this.boardOpened = this.tab === 'board';
		// Nor its comments, which read every page and look up each attached image.
		this.commentsOpened = this.tab === 'comments';
		// Nor its documents; the tab counts them again once opened.
		this.documentsOpened = this.tab === 'documents';
		this.documentCount = 0;
		this.tracking = loading(null);
		this.workers = [];
		// The Overview's other panels too: opened later, it shows none of the previous task's figures meanwhile.
		this.hours = loading([]);
		this.entries = loading([]);
		this.links = loading([]);
		this.statuses = [];
		this.currentStatusId = null;
		this.commentCount = 0;
		this.commentCountFromTab = false;
		const commentSequence = ++this.commentCountSequence;
		this.state = 'loading';
		try {
			const task = await this.tasksService.getById(id, TASK_PAGE_RELATIONS);
			if (sequence !== this.loadSequence) {
				return; // a newer navigation or organization switch owns the page
			}
			if (!task?.id || (task.organizationId && task.organizationId !== organizationId)) {
				throw { status: 404 };
			}
			// Another task, or organization, starts with the Overview unopened unless it is the tab on screen. Set here
			// and not with the resets above: the first load starts before the URL has named the tab.
			this.overviewOpened = this.tab === 'overview';
			this.task = task;
			this.show();
			this.state = 'ready';
			this.loadPanels(task, sequence);
			void this.loadCommentCount(task.id, commentSequence);
		} catch (error) {
			if (sequence !== this.loadSequence) {
				return;
			}
			this.task = null;
			this.state = recordViewPageStateOf(error);
		}
	}

	/**
	 * Reads the task again in place, after a change to `taskId`: the page stays on screen while it does. A change
	 * that lands once the page has moved on to another task leaves that task's load alone.
	 */
	private async refresh(taskId: string): Promise<void> {
		if (this.state !== 'ready' || this.task?.id !== taskId) return;
		const sequence = ++this.loadSequence;
		this.refreshSequence = sequence;
		try {
			const task = await this.tasksService.getById(taskId, TASK_PAGE_RELATIONS);
			if (sequence !== this.loadSequence) return;
			if (!task?.id) {
				this.reloadPanels(sequence);
				return;
			}
			// Moved to another project (an edit, a move on a board): the old project's statuses are not this task's.
			// They go, as on a load, so neither the status menu nor a new subtask takes one while the new ones are read.
			if ((task.projectId ?? null) !== (this.task?.projectId ?? null)) {
				this.statuses = [];
				this.currentStatusId = null;
			}
			this.task = task;
			this.show();
			this.loadPanels(task, sequence);
		} catch {
			// The page keeps the task it showed; its panels, whose reads the new sequence discarded, read again.
			if (sequence === this.loadSequence) this.reloadPanels(sequence);
		} finally {
			if (this.refreshSequence === sequence) this.refreshSequence = null;
		}
	}

	/** Reads the panels of the task on screen again, so none keeps a spinner a discarded read left. */
	private reloadPanels(sequence: number): void {
		if (this.task) this.loadPanels(this.task, sequence);
	}

	/* ── Actions ── */

	/** Opens a tab, keeping it in the URL without a new history entry per click. */
	selectTab(tab: TaskViewTab): void {
		this.openTab(tab);
		void this.router.navigate([], {
			relativeTo: this.route,
			// A tab the user chose: the comment a link pointed at is no longer pointed at, or the tab could not be left.
			queryParams: { tab: tab === 'overview' ? null : tab, comment: null },
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}

	private openTab(tab: TaskViewTab): void {
		this.tab = tab;
		if (tab === 'overview' && !this.overviewOpened) {
			this.overviewOpened = true;
			// Opened once the task is on screen: its panels read now. Opened while it loads, or while a refresh reads it
			// again, that read fills them: panels read now for the task it replaces would share its sequence, and an
			// answer of theirs landing last would show the old task's figures — its estimate, its time left.
			if (this.task && this.state === 'ready' && this.refreshSequence !== this.loadSequence) {
				this.loadOverview(this.task, this.loadSequence);
			}
		}
		if (tab === 'board') this.boardOpened = true;
		if (tab === 'comments') this.commentsOpened = true;
		if (tab === 'documents') this.documentsOpened = true;
	}

	/**
	 * Whether the Documents tab is offered: the same gates as its panel — DOCS_READ and the
	 * organization's Documents feature — so the tab never opens on an empty pane.
	 */
	private hasDocumentsAccess(): boolean {
		return this.store.hasPermission(PermissionsEnum.DOCS_READ) && this.store.hasFeatureEnabled(FeatureEnum.FEATURE_DOCUMENTS);
	}

	/** Whether a tab named in the URL may open; the others fall back to the Overview. */
	private canOpenTab(tab: TaskViewTab): boolean {
		return tab !== 'documents' || this.canSeeDocuments;
	}

	/** The count the Documents tab reports after each load, upload or removal. */
	onDocumentCount(count: number): void {
		this.documentCount = count;
	}

	/** The count the Comments tab reports each time it reads its list, after a post or a delete among others. */
	onCommentCount(count: number): void {
		this.commentCountFromTab = true;
		this.commentCount = count;
	}

	/**
	 * A card moved on the Board — the task's own or a subtask's: the task is read again, so the header's status and
	 * the Subtasks panel show the new one, then an open Activity tab reads again — it may have been opened while the
	 * move was still saving.
	 */
	async onBoardTaskMoved(): Promise<void> {
		if (!this.task) return;
		const taskId = this.task.id;
		await this.refresh(taskId);
		if (this.task?.id === taskId) this.activityReloadKey++;
	}

	/** After a change made from the header: the Board and the Activity read again. */
	private reloadPanes(): void {
		this.boardReloadKey++;
		this.activityReloadKey++;
	}

	/**
	 * Moves the task to another status — the status alone, as the project board does, so nothing else read
	 * with the page can undo a newer edit — then reads the task again.
	 */
	async changeStatus(statusId: string): Promise<void> {
		const status = this.statuses.find((item) => item.id === statusId);
		if (!status || !this.task || this.savingStatus || status.id === this.currentStatusId) return;
		const taskId = this.task.id;
		this.savingStatus = true;
		try {
			await firstValueFrom(
				this.http.put<ITask>(`${API_PREFIX}/tasks/${taskId}/status`, {
					status: status.value || status.name,
					taskStatusId: status.id,
					...this.scope()
				})
			);
			await this.refresh(taskId);
			// After the read: the server writes the move's log entry as the update lands.
			this.reloadPanes();
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.savingStatus = false;
		}
	}

	/**
	 * Moves a subtask to another status from its row, as the header moves the task: the status alone. The row shows it
	 * at once and a failed save puts it back, or the menu, which keeps its own selection, would show a status that
	 * was never saved. The task is read again after, so the rows' order, the count and the bar follow.
	 */
	async changeSubtaskStatus(row: ISubtaskRow, statusId: string): Promise<void> {
		const status = this.statuses.find((item) => item.id === statusId);
		if (!status || !this.task || !this.canEdit || !row.sameProject) return;
		if (this.savingSubtasks.has(row.id) || status.id === row.statusId) return;
		const { id: subtaskId, statusId: previousStatusId } = row;
		const taskId = this.task.id;
		row.statusId = status.id;
		this.savingSubtasks.add(subtaskId);
		try {
			await firstValueFrom(
				this.http.put<ITask>(`${API_PREFIX}/tasks/${subtaskId}/status`, {
					status: status.value || status.name,
					taskStatusId: status.id,
					...this.scope()
				})
			);
			await this.refresh(taskId);
			// After the read: the server writes the move's log entry as the update lands.
			this.reloadPanes();
		} catch (error) {
			// Another row's save may have read the task again meanwhile: the row on screen is found afresh.
			const current = this.subtasks.find((item) => item.id === subtaskId);
			if (current) current.statusId = previousStatusId;
			this.toastrService.danger(error);
		} finally {
			this.savingSubtasks.delete(subtaskId);
		}
	}

	/**
	 * Opens the task dialog the task list edits with, on the task read as the list reads it — with its modules,
	 * which the dialog saves back — then saves what it answers and reads the task again. A failed read opens no
	 * dialog: one opened without the modules would unlink them all.
	 */
	async edit(): Promise<void> {
		if (!this.task || !this.canEdit) return;
		const taskId = this.task.id;
		let selectedTask: ITask;
		try {
			selectedTask = await this.tasksService.getById(taskId, TASK_EDIT_RELATIONS);
		} catch (error) {
			this.toastrService.danger(error);
			return;
		}
		// The page moved on to another task while the read was under way.
		if (!selectedTask?.id || this.task?.id !== taskId) return;
		const dialog = this.dialogService.open(AddTaskDialogComponent, { context: { selectedTask } });
		const data: any = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!data) return;
		try {
			await firstValueFrom(
				this.tasksService.editTask({
					...data,
					estimate: this.estimateOf(data),
					...this.scope(),
					id: taskId
				})
			);
			await this.refresh(taskId);
			this.reloadPanes();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/**
	 * Opens the task dialog on a new task under this one: the parent shown and fixed, the task's project and teams
	 * filled in — so it is numbered with its siblings and shows on their lists — and the project's opening status. The
	 * dialog holds no id, so it creates; it answers what to save, which is saved here with the parent it leaves out.
	 * The dialog's form requires a status and saves the one `taskStatus` names, so both are given, and Open backs up
	 * a save with neither: the status menu picks no default of its own for a status named otherwise than `open`.
	 * Statuses not read yet, or skipped because the permission to add came late, are read first: the opening status
	 * is the project's to say.
	 */
	async addSubtask(): Promise<void> {
		if (!this.task || !this.canAddSubtask || this.openingSubtask) return;
		const { id: taskId } = this.task;
		let statuses = this.statuses;
		if (!statuses.length) {
			this.openingSubtask = true;
			// The dialog's own read: a refresh of the task meanwhile neither discards it nor is overwritten by it. A
			// refresh that moved the task to another project has them read again, for that one.
			let projectId: string | undefined;
			do {
				projectId = this.task.projectId;
				statuses = await this.readStatuses(projectId).catch((): ITaskStatus[] => []);
			} while (this.task?.id === taskId && (this.task.projectId ?? null) !== (projectId ?? null));
			this.openingSubtask = false;
			// The page moved on to another task while the read was under way.
			if (this.task?.id !== taskId || !this.canAddSubtask) return;
		}
		const { project, teams } = this.task;
		const selectedTask = {
			parent: this.task,
			project,
			teams,
			status: TaskStatusEnum.OPEN,
			taskStatus: newTaskStatusOf(statuses)
		} as ITask;
		const dialog = this.dialogService.open(AddTaskDialogComponent, { context: { selectedTask, parentLocked: true } });
		const data: any = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!data) return;
		try {
			await firstValueFrom(
				this.tasksService.createTask({
					...data,
					status: data.status || TaskStatusEnum.OPEN,
					estimate: this.estimateOf(data),
					parentId: taskId,
					...this.scope()
				})
			);
			await this.refresh(taskId);
			this.reloadPanes();
		} catch {
			// The service has shown the error.
		}
	}

	/** The seconds the task dialog's estimate fields add up to, or none when they are blank. */
	private estimateOf({ estimateDays, estimateHours, estimateMinutes }: any): number | null {
		const estimate =
			(Number(estimateDays) || 0) * 24 * 60 * 60 + (Number(estimateHours) || 0) * 60 * 60 + (Number(estimateMinutes) || 0) * 60;
		return estimate || null;
	}

	/** Copies the page's address, with the open tab, to paste in a chat or a ticket. */
	async copyLink(): Promise<void> {
		if (!this.task) return;
		const path = this.router.serializeUrl(
			this.router.createUrlTree(['/pages/tasks/view', this.task.id], {
				queryParams: this.tab === 'overview' ? {} : { tab: this.tab }
			})
		);
		const { origin, pathname, hash } = window.location;
		// The app routes by the hash (`/#/pages/…`); the link keeps to it.
		const url = hash.startsWith('#/') ? `${origin}${pathname}#${path}` : `${origin}${path}`;
		try {
			await navigator.clipboard.writeText(url);
			this.toastrService.success('TASK_VIEW.LINK_COPIED');
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/* ── View helpers ── */

	/** Whether the task sits under another. Subtasks go one level deep for now: a subtask takes none of its own. */
	get isSubtask(): boolean {
		return !!(this.task?.parentId || this.task?.parent);
	}

	/**
	 * Where the back button leads: a subtask's own task, else the list a task belongs to. By the parent as read, not
	 * its id: the id outlives a deleted parent, whose page would read "not found".
	 */
	get backLink(): string {
		const parentId = this.task?.parent?.id;
		return parentId ? `/pages/tasks/view/${parentId}` : '/pages/tasks/dashboard';
	}

	/** What the back button is named: the task it returns to, when it does not lead to the list. */
	get backLabel(): string {
		return this.task?.parent?.id ? 'TASKS_PAGE.PARENT_TASK' : 'RECORD_VIEW_PAGE.BACK_TO_LIST';
	}

	/** Whether the Subtasks panel offers to add one. */
	get canAddSubtask(): boolean {
		return this.canCreateTasks && !this.isSubtask;
	}

	/** The menu's entry for the task's status, for the button's label and colour. */
	get currentStatus(): ITaskStatus | null {
		return this.statuses.find((status) => status.id === this.currentStatusId) || null;
	}

	taskLink(id: string): string[] {
		return ['/pages/tasks/view', id];
	}

	peopleNames(people: IPersonChip[]): string {
		return people.map((person) => person.name).join(', ');
	}

	/** A status's name in a row, read as words: a seeded status is named by its slug, `ready-for-review`. */
	readonly statusName = humanize;

	/** The menu's entry for a subtask's status, for its button's label and colour. */
	menuStatusOf(row: ISubtaskRow): ITaskStatus | null {
		return this.statuses.find((status) => status.id === row.statusId) || null;
	}

	/** The total of the hours chart, so an empty fortnight says so instead of drawing flat bars. */
	get hoursTotal(): number {
		return (this.hours.value || []).reduce((sum, day) => sum + day.tracked + day.manual, 0);
	}

	formatHours = (hours: number): string => formatDuration((Number(hours) || 0) * 3600);

	/* ── Reads ── */

	/**
	 * Every panel reads on its own; a failure (most often a 403) blanks only its panel. The Overview's read only once it
	 * is open: a page on another tab reads them when the Overview is first opened.
	 */
	private loadPanels(task: ITask, sequence: number): void {
		if (this.overviewOpened) this.loadOverview(task, sequence);
		// The status menu's choices — in the header, and with the Board's filters — and the status a new subtask
		// starts in: on every tab.
		if (this.canEdit || this.canAddSubtask) void this.loadStatuses(task, sequence);
	}

	/** The Overview's panels: the time worked and who worked it, the hours per day, the time entries, the links. */
	private loadOverview(task: ITask, sequence: number): void {
		void this.loadTime(task, sequence);
		void this.loadHours(task, sequence);
		void this.loadEntries(task, sequence);
		void this.loadLinks(task, sequence);
	}

	/**
	 * The time worked on the task, all time, against its estimate, and who worked most on it: each employee's
	 * time on it, summed by the server. The project lets a manager of it see its members' time.
	 */
	private async loadTime(task: ITask, sequence: number): Promise<void> {
		this.tracking = loading(this.tracking.value);
		const filters = { ...this.scope(), taskIds: [task.id], ...(task.projectId ? { projectIds: [task.projectId] } : {}) };
		const [totals, people] = await Promise.allSettled([
			this.statisticsService.getTasksStatistics(filters),
			this.statisticsService.getTaskEmployees(filters)
		]);
		if (sequence !== this.loadSequence) return;
		if (totals.status === 'fulfilled') {
			const row = (totals.value || []).find((item) => item.id === task.id);
			this.tracking = loaded(timeTrackingOf(Number(row?.duration) || 0, task.estimate));
		} else {
			this.tracking = failed(null);
		}
		this.workers = people.status === 'fulfilled' ? taskWorkersOf(people.value || [], 5) : [];
	}

	/** The hours worked on the task each day of the last fortnight, tracked and manual. */
	private async loadHours(task: ITask, sequence: number): Promise<void> {
		this.hours = loading([]);
		try {
			const rows = await this.timesheetService.getDailyReportChart({
				...this.range(HOURS_DAYS),
				taskIds: [task.id]
			});
			if (sequence !== this.loadSequence) return;
			this.hours = loaded(hoursDaysOf(rows));
		} catch {
			if (sequence === this.loadSequence) this.hours = failed([]);
		}
	}

	/** The newest time entries of the last month, with their activity; the server keeps to what the viewer may see. */
	private async loadEntries(task: ITask, sequence: number): Promise<void> {
		this.entries = loading([]);
		try {
			const logs = await this.timesheetService.getTimeLogs({ ...this.range(ENTRIES_DAYS), taskIds: [task.id] }, [
				'employee',
				'employee.user',
				'timeSlots'
			]);
			if (sequence !== this.loadSequence) return;
			this.entries = loaded(timeEntriesOf(logs || []));
		} catch {
			if (sequence === this.loadSequence) this.entries = failed([]);
		}
	}

	/** The links the task starts and the links that end at it, read side by side. */
	private async loadLinks(task: ITask, sequence: number): Promise<void> {
		this.links = loading([]);
		const read = (where: Record<string, string>, relations: string[]) =>
			firstValueFrom(
				this.http.get<IPagination<ITaskLinkedIssue>>(`${API_PREFIX}/task-linked-issue`, {
					params: toParams({ where: { ...this.scope(), ...where }, relations })
				})
			);
		const [outgoing, incoming] = await Promise.allSettled([
			read({ taskFromId: task.id }, ['taskTo', 'taskTo.taskStatus']),
			read({ taskToId: task.id }, ['taskFrom', 'taskFrom.taskStatus'])
		]);
		if (sequence !== this.loadSequence) return;
		if (outgoing.status === 'rejected' && incoming.status === 'rejected') {
			this.links = failed([]);
			return;
		}
		this.links = loaded(
			linkedIssueGroupsOf(
				outgoing.status === 'fulfilled' ? outgoing.value?.items || [] : [],
				incoming.status === 'fulfilled' ? incoming.value?.items || [] : [],
				task.id,
				(value) => this.hashNumberPipe.transform(value)
			)
		);
	}

	/**
	 * The Comments tab's count, before the tab is opened; a failed read leaves the tab without one. An answer that
	 * comes after the tab has counted for itself is older than the tab's count, and is dropped. It is kept to the
	 * visit it was read for, not to the load sequence: a refresh after a status move leaves the comments as they were.
	 */
	private async loadCommentCount(taskId: string, sequence: number): Promise<void> {
		try {
			const count = await this.commentService.count(BaseEntityEnum.Task, taskId, this.scope());
			if (sequence === this.commentCountSequence && !this.commentCountFromTab) this.commentCount = count;
		} catch {
			// The tab shows no count.
		}
	}

	/** The statuses the task's project takes, for the menus. */
	private async loadStatuses(task: ITask, sequence: number): Promise<void> {
		try {
			const statuses = await this.readStatuses(task.projectId);
			if (sequence !== this.loadSequence) return;
			this.statuses = statuses;
			this.currentStatusId = this.currentStatusOf(task);
			// The rows find their entries in the menu now that it has them.
			this.subtasks = this.subtasksOf(task);
		} catch {
			// The status shows without its menu.
		}
	}

	/** The statuses a project takes, in their order, as the project board's columns. */
	private async readStatuses(projectId: string | undefined): Promise<ITaskStatus[]> {
		const read = async (where: Record<string, string>) =>
			(
				await firstValueFrom(
					this.http.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, {
						params: toParams(where)
					})
				)
			)?.items || [];
		const statuses = await scopedTaskStatusesOf(read, { ...this.scope(), projectId });
		return [...statuses].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
	}

	/**
	 * The task's status among the menu's, as the project board finds a card's column: by its status row, else by
	 * its status value or name — many tasks carry only the value. None when the menu has no such status.
	 */
	private currentStatusOf(task: ITask): string | null {
		const normalize = (value?: string) => (value || '').trim().toLowerCase().replace(/\s+/g, '-');
		const byRow = task.taskStatusId && this.statuses.find((status) => status.id === task.taskStatusId);
		if (byRow) return byRow.id;
		const keys = new Set([normalize(task.status), normalize(task.taskStatus?.name)].filter(Boolean));
		const byName = this.statuses.find((status) => keys.has(normalize(status.value)) || keys.has(normalize(status.name)));
		return byName?.id ?? null;
	}

	private scope() {
		return { organizationId: this.organization?.id, tenantId: this.organization?.tenantId };
	}

	/** The last `days` days, to the end of today, as the time endpoints read a window. */
	private range(days: number) {
		const timeZone = this.timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');
		return {
			...this.scope(),
			startDate: format(moment().subtract(days - 1, 'days').startOf('day')),
			endDate: format(moment().endOf('day')),
			timeZone
		};
	}

	/** Works out everything the page shows from the task. */
	private show(): void {
		const task = this.task;
		if (!task) {
			return;
		}
		this.status = taskStatusOf(task);
		this.subtasks = this.subtasksOf(task);
		const done = this.subtasks.filter((row) => row.done).length;
		const total = this.subtasks.length;
		this.subtaskCount = total ? { done, total, percent: (done / total) * 100 } : null;
		const sections = buildTaskViewSections(task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this.hashNumberPipe.transform(value)
		});
		// The description is the work, beside the subtasks; the details and the stamps are the facts. The
		// status is the header's button, as in Jira, and the project has a panel of its own, so the details leave
		// both out.
		const ownedElsewhere = new Set(['TASKS_PAGE.TASKS_STATUS', 'TASKS_PAGE.TASKS_PROJECT']);
		this.mainSections = sections.filter((section) => section.variant === 'plain');
		this.metaSections = sections.filter((section) => section.variant === 'meta');
		this.detailsSections = sections
			.filter((section) => section.variant !== 'plain' && section.variant !== 'meta')
			.map((section) => ({
				...section,
				fields: section.fields.filter((field) => !ownedElsewhere.has(field.label))
			}));
	}

	/** Open subtasks first, then the finished ones, each by number. */
	private subtasksOf(task: ITask): ISubtaskRow[] {
		return (task.children || [])
			.map((child) => ({ child, done: isTaskFinished(child) }))
			.sort((a, b) => Number(a.done) - Number(b.done) || (Number(a.child.number) || 0) - (Number(b.child.number) || 0))
			.map(({ child, done }) => {
				// `taskNumber` is a server-side virtual column (prefix + number), absent from ITask.
				const number = (child as any).taskNumber;
				return {
					id: child.id,
					key: number ? this.hashNumberPipe.transform(number) : '',
					title: child.title,
					status: taskStatusOf(child),
					statusId: this.currentStatusOf(child),
					sameProject: (child.projectId ?? null) === (task.projectId ?? null),
					priority: taskPriorityOf(child),
					people: (child.members || []).map((member) => personOf(member)).filter(Boolean),
					done
				};
			});
	}
}
