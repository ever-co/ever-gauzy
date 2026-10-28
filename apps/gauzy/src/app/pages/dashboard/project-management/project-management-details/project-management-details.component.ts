import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { combineLatest, debounceTime, filter, first, firstValueFrom, map, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { pluck } from 'underscore';
import * as moment from 'moment';
import {
	ID,
	IOrganization,
	IOrganizationProject,
	ISelectedEmployee,
	ITask,
	PermissionsEnum,
	TaskPriorityEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	ServerDataSource,
	Store,
	TasksService
} from '@gauzy/ui-core/core';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	AddTaskDialogComponent,
	HashNumberPipe,
	IRecordViewSection,
	IRecordViewStatus,
	PaginationFilterBaseComponent
} from '@gauzy/ui-core/shared';
import { MyTaskDialogComponent } from '../../../tasks/components/my-task-dialog/my-task-dialog.component';
import {
	buildTaskViewSections,
	taskStatusOf,
	TASK_VIEW_RELATIONS
} from '../../../tasks/components/task-view/task-view-sections';
import { IProjectQuickLookCard } from '../../../projects/components/project-quick-look/project-quick-look.component';

/** Colour family of a status pill; each maps to one of the gauzy action accents in the stylesheet. */
export type TaskStatusTone = 'success' | 'info' | 'warning' | 'danger' | 'muted' | 'neutral';

/** How close a task is to its due date; `null` when it has none or is already closed. */
export type TaskDueState = 'overdue' | 'today' | 'soon' | null;

/** The status tabs; each stands for one or more task statuses. */
export type TaskStatusFilter = 'all' | 'open' | 'progress' | 'review' | 'done';

/** The due-date filter. */
export type TaskDueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';

/** One `filters[...]` query parameter, as the server data source sends it. */
interface IAdvancedFilterParam {
	field: string;
	search: string | string[] | boolean;
}

const CLOSED_STATUSES: string[] = [TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED];
const DUE_SOON_DAYS = 3;
const SEARCH_DEBOUNCE_MS = 300;

export const STATUS_FILTER_STATUSES: Record<Exclude<TaskStatusFilter, 'all'>, TaskStatusEnum[]> = {
	open: [TaskStatusEnum.OPEN],
	progress: [TaskStatusEnum.IN_PROGRESS],
	review: [TaskStatusEnum.READY_FOR_REVIEW, TaskStatusEnum.IN_REVIEW],
	done: [TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED]
};

/** Every status a task can still be worked in: what "Overdue" means with no status tab picked. */
const ACTIVE_STATUSES: TaskStatusEnum[] = Object.values(TaskStatusEnum).filter(
	(status) => !CLOSED_STATUSES.includes(status)
);

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-project-management-details',
    templateUrl: './project-management-details.component.html',
    styleUrls: ['./project-management-details.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProjectManagementDetailsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	private _smartTableSource: ServerDataSource;
	private _tasks: ITask[] = [];
	private _selectedEmployee: ISelectedEmployee;
	public selectedEmployeeId: ID;
	private selectedProjectId: ID;
	private _organization: IOrganization;
	private _task$: Subject<boolean> = this.subject$;
	private _projects: IOrganizationProject[] = [];
	private _projectTaskCount: Record<string, number> = {};
	public status = TaskStatusEnum;
	public readonly permissions = PermissionsEnum;
	public totalTasks = 0;
	public tasksLoading = false;
	// Bumped by every reload and every fetch: a response from an older one is dropped, so it can
	// neither append rows from the previous filters nor end the newer fetch's loading state.
	private _taskRequest = 0;

	// Quick looks: the same task and project drawers as the employee page.
	public viewedTask: ITask | null = null;
	public viewSections: IRecordViewSection[] = [];
	public viewStatus: IRecordViewStatus | null = null;
	public viewedProject: IProjectQuickLookCard | null = null;
	// The dashboard's date range as ISO dates, for the project drawer's period figures.
	public rangeStart: string;
	public rangeEnd: string;
	// Bumped on every task open or close, so a slow detail load never replaces a newer drawer.
	private _viewSequence = 0;
	private readonly _hashPipe = new HashNumberPipe();

	// Filter bar. Every filter is applied by the server, so paging and the "n of total" count stay right.
	public readonly statusFilters: { key: TaskStatusFilter; label: string }[] = [
		{ key: 'all', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.FILTER_ALL' },
		{ key: 'open', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.FILTER_OPEN' },
		{ key: 'progress', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.FILTER_IN_PROGRESS' },
		{ key: 'review', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.FILTER_IN_REVIEW' },
		{ key: 'done', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.FILTER_DONE' }
	];
	public readonly priorityFilters: { key: TaskPriorityEnum; label: string }[] = [
		{ key: TaskPriorityEnum.URGENT, label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.PRIORITY_URGENT' },
		{ key: TaskPriorityEnum.HIGH, label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.PRIORITY_HIGH' },
		{ key: TaskPriorityEnum.MEDIUM, label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.PRIORITY_MEDIUM' },
		{ key: TaskPriorityEnum.LOW, label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.PRIORITY_LOW' }
	];
	public readonly dueFilters: { key: TaskDueFilter; label: string }[] = [
		{ key: 'any', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.ANY_DUE_DATE' },
		{ key: 'overdue', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.OVERDUE' },
		{ key: 'today', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.DUE_TODAY' },
		{ key: 'week', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.DUE_THIS_WEEK' },
		{ key: 'none', label: 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.NO_DUE_DATE' }
	];
	public statusFilter: TaskStatusFilter = 'all';
	// `'all'` rather than null: nb-select shows the selected option's label, and null has none.
	public priorityFilter: TaskPriorityEnum | 'all' = 'all';
	public dueFilter: TaskDueFilter = 'any';
	public searchTerm = '';
	private readonly _search$ = new Subject<string>();

	constructor(
		readonly translateService: TranslateService,
		private readonly _httpClient: HttpClient,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _dialogService: NbDialogService,
		private readonly _tasksService: TasksService,
		private readonly _router: Router,
		private readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._search$
			.pipe(
				debounceTime(SEARCH_DEBOUNCE_MS),
				map((term) => (term || '').trim()),
				// Against the applied term, not the last typed one, so it holds after "Clear filters".
				filter((term) => term !== this.searchTerm),
				tap((term) => {
					this.searchTerm = term;
					this._reload();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._dateRangePickerBuilderService.selectedDateRange$
			.pipe(
				filter((range) => !!range?.startDate && !!range?.endDate),
				tap(({ startDate, endDate }) => {
					this.rangeStart = new Date(startDate).toISOString();
					this.rangeEnd = new Date(endDate).toISOString();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;
		const storeProject$ = this._store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee, project]) => {
					this._organization = organization;
					this._selectedEmployee = employee;
					this.selectedEmployeeId = employee ? employee.id : null;
					this.selectedProjectId = project ? project.id : null;
				}),
				// A drawer opened for the previous selection would describe a task or project no longer listed.
				tap(() => {
					this.closeTask();
					this.closeProject();
				}),
				tap(() => this._reload()),
				untilDestroyed(this)
			)
			.subscribe();
		this._task$
			.pipe(
				debounceTime(400),
				tap(() => this._getTasks()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this._task$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Starts the task list over from its first page.
	 */
	private _reload(): void {
		// The next fetch waits out a debounce; a request still in flight must not refill the list meanwhile.
		this._taskRequest++;
		this.refreshPagination();
		this.tasks = [];
		this._task$.next(true);
	}

	/**
	 * `/tasks/employee` when an employee is selected (it reads them from `members.id`), otherwise `/tasks/pagination`.
	 */
	private get _endPoint(): string {
		return this.selectedEmployeeId ? `${API_PREFIX}/tasks/employee` : `${API_PREFIX}/tasks/pagination`;
	}

	/**
	 * The task list filter: organization, plus the selected employee and project.
	 */
	private _buildWhere(): Record<string, unknown> {
		const { id: organizationId, tenantId } = this._organization;
		return {
			organizationId,
			tenantId,
			// `/tasks/employee` reads the selected employee from `members.id` (as the Tasks page sends it)
			...(this.selectedEmployeeId ? { members: { id: this.selectedEmployeeId } } : {}),
			...(this.selectedProjectId ? { projectId: this.selectedProjectId } : {}),
			// Both task endpoints match `title` with LIKE.
			...(this.searchTerm ? { title: this.searchTerm } : {}),
			...(this.filters.where ? this.filters.where : {})
		};
	}

	/**
	 * The filter bar's status, priority and due-date choices as the API's advanced filters
	 * (`filters[statuses]`, `filters[dueDateTo]`…). "Overdue" with no status tab picked leaves out
	 * closed tasks: a done task past its due date is not overdue.
	 */
	public advancedFilters(now: Date = new Date()): IAdvancedFilterParam[] {
		const params: IAdvancedFilterParam[] = [];

		let statuses: string[] = STATUS_FILTER_STATUSES[this.statusFilter as Exclude<TaskStatusFilter, 'all'>] ?? [];
		if (this.dueFilter === 'overdue' && !statuses.length) {
			statuses = ACTIVE_STATUSES;
		}
		if (statuses.length) {
			params.push({ field: 'statuses', search: statuses });
		}
		if (this.priorityFilter && this.priorityFilter !== 'all') {
			params.push({ field: 'priorities', search: [this.priorityFilter] });
		}

		const today = moment(now).startOf('day');
		switch (this.dueFilter) {
			case 'overdue':
				params.push({ field: 'dueDateTo', search: today.clone().subtract(1, 'millisecond').toISOString() });
				break;
			case 'today':
				params.push({ field: 'dueDateFrom', search: today.toISOString() });
				params.push({ field: 'dueDateTo', search: today.clone().endOf('day').toISOString() });
				break;
			case 'week':
				// From today to the end of the locale's week; anything earlier is "Overdue".
				params.push({ field: 'dueDateFrom', search: today.toISOString() });
				params.push({ field: 'dueDateTo', search: today.clone().endOf('week').toISOString() });
				break;
			case 'none':
				params.push({ field: 'withoutDueDate', search: true });
				break;
		}
		return params;
	}

	public get hasActiveFilters(): boolean {
		return (
			this.statusFilter !== 'all' ||
			this.priorityFilter !== 'all' ||
			this.dueFilter !== 'any' ||
			!!this.searchTerm
		);
	}

	public setStatusFilter(value: TaskStatusFilter): void {
		if (value !== this.statusFilter) {
			this.statusFilter = value;
			this._reload();
		}
	}

	public setPriorityFilter(value: TaskPriorityEnum | 'all'): void {
		if (value !== this.priorityFilter) {
			this.priorityFilter = value;
			this._reload();
		}
	}

	public setDueFilter(value: TaskDueFilter): void {
		if (value !== this.dueFilter) {
			this.dueFilter = value;
			this._reload();
		}
	}

	public onSearch(value: string): void {
		this._search$.next(value);
	}

	public clearFilters(searchInput?: HTMLInputElement): void {
		this.statusFilter = 'all';
		this.priorityFilter = 'all';
		this.dueFilter = 'any';
		this.searchTerm = '';
		if (searchInput) {
			searchInput.value = '';
		}
		// Restarts the search debounce with the cleared term, so a term typed just before clearing
		// is dropped instead of being applied once its delay runs out.
		this._search$.next('');
		this._reload();
	}

	/*
	 * Register Smart Table Source Config
	 */
	private _setSmartTableSource(): ServerDataSource | undefined {
		if (!this._organization) {
			return;
		}
		this._smartTableSource = new ServerDataSource(this._httpClient, {
			endPoint: this._endPoint,
			relations: ['project', 'tags'],
			where: this._buildWhere()
		});
		// Sent as `filters[field]` query parameters; the smart-table typing only allows string searches.
		this._smartTableSource.setFilter(this.advancedFilters() as any, false);
		return this._smartTableSource;
	}

	private async _getTasks() {
		if (!this._organization) {
			return;
		}
		const request = ++this._taskRequest;
		this.tasksLoading = true;
		try {
			// Its own source: a later fetch replaces `_smartTableSource` while this one is in flight.
			const source = this._setSmartTableSource();
			const { activePage, itemsPerPage } = this.getPagination();

			source.setPaging(activePage, itemsPerPage, false);
			source.setSort([{ field: 'dueDate', direction: 'asc' }]);

			await source.getElements();
			if (request !== this._taskRequest) {
				return;
			}
			this._tasks.push(...source.getData());
			this.totalTasks = source.count();
			this._sortProjectByPopularity();
		} catch (error) {
			if (request === this._taskRequest) {
				this._errorHandlingService.handleError(error);
			}
		} finally {
			if (request === this._taskRequest) {
				this.tasksLoading = false;
			}
		}
	}

	/** More tasks exist on the server than the list holds. */
	public get hasMoreTasks(): boolean {
		return this.tasks.length < this.totalTasks;
	}

	private _sortProjectByPopularity() {
		const count: Record<string, number> = {};
		const projects = pluck(this.tasks, 'project').filter(Boolean);

		projects.forEach(({ id }) => {
			count[id] = (count[id] || 0) + 1;
		});
		this._projectTaskCount = count;
		this.projects = projects.filter((value, index, self) => index === self.findIndex(({ id }) => id === value.id));
		this.projects.sort((current, next) => -(count[current.id] - count[next.id]));
	}

	public get isMyTask() {
		if (!this._store.user) {
			return;
		}
		return this.selectedEmployeeId === this._store.user.employee?.id;
	}

	/** Next page, from the list's infinite scroll or its "Show more" button. */
	public onScrollTasks(): void {
		if (this.tasksLoading || !this.hasMoreTasks) {
			return;
		}
		// Pending from now, not from when the debounced fetch starts: a second click or scroll in
		// between would advance past this page, and only the later one would be fetched. The fetch
		// for this page clears it, whether it succeeds or fails.
		this.tasksLoading = true;
		const activePage = this.pagination.activePage + 1;
		this.setPagination({
			...this.getPagination(),
			activePage: activePage
		});
	}

	public get tasks(): ITask[] {
		return this._tasks;
	}

	public set tasks(value: ITask[]) {
		this._tasks = value;
	}

	public get projects(): IOrganizationProject[] {
		return this._projects;
	}

	public set projects(value: IOrganizationProject[]) {
		this._projects = value;
	}

	public get assigned(): ITask[] {
		return this.tasks.filter(({ status }) => status === this.status.OPEN).reverse();
	}

	/** Loaded tasks that belong to the given project; the projects panel ranks by this. */
	public projectTaskCount(project: IOrganizationProject): number {
		return this._projectTaskCount[project.id] || 0;
	}

	/** The task's human reference, e.g. `GAU-42`, when it has one. */
	public taskReference(task: ITask): string | null {
		if (task?.prefix && task?.number) {
			return `${task.prefix.toUpperCase()}-${task.number}`;
		}
		return null;
	}

	/** Status slugs are hyphenated (`in-progress`); the stylesheet capitalizes the words. */
	public statusLabel(status: string): string {
		return (status || '').replace(/-/g, ' ');
	}

	public statusTone(status: string): TaskStatusTone {
		switch (status) {
			case TaskStatusEnum.DONE:
			case TaskStatusEnum.COMPLETED:
				return 'success';
			case TaskStatusEnum.IN_PROGRESS:
				return 'info';
			case TaskStatusEnum.READY_FOR_REVIEW:
			case TaskStatusEnum.IN_REVIEW:
				return 'warning';
			case TaskStatusEnum.BLOCKED:
				return 'danger';
			case TaskStatusEnum.BACKLOG:
			case TaskStatusEnum.CANCELLED:
				return 'muted';
			default:
				return 'neutral';
		}
	}

	public isClosed(task: ITask): boolean {
		return CLOSED_STATUSES.includes(task?.status);
	}

	/**
	 * Compares calendar days, not instants, so a task due later today is "today" rather than "soon",
	 * and one due yesterday evening is overdue this morning.
	 */
	public dueState(task: ITask): TaskDueState {
		if (!task?.dueDate || this.isClosed(task)) {
			return null;
		}
		const due = new Date(task.dueDate);
		if (isNaN(due.getTime())) {
			return null;
		}
		const today = new Date();
		const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
		const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
		const days = Math.round((startOfDue - startOfToday) / 86_400_000);

		if (days < 0) {
			return 'overdue';
		}
		if (days === 0) {
			return 'today';
		}
		return days <= DUE_SOON_DAYS ? 'soon' : null;
	}

	public async addTodo() {
		if (!this._organization) {
			return;
		}
		let dialog: any;
		if (!this.isMyTask) {
			dialog = this._dialogService.open(AddTaskDialogComponent, {
				context: {
					selectedTask: this.selectedEmployeeId
						? ({
								members: [{ ...this._selectedEmployee }] as any,
								status: this.status.OPEN
						  } as ITask)
						: ({} as ITask)
				}
			});
		} else {
			dialog = this._dialogService.open(MyTaskDialogComponent, {
				context: {}
			});
		}
		if (dialog) {
			const data: any = await firstValueFrom(dialog.onClose.pipe(first()));
			if (data) {
				const { estimateDays, estimateHours, estimateMinutes } = data;
				const estimate = estimateDays * 24 * 60 * 60 + estimateHours * 60 * 60 + estimateMinutes * 60;

				estimate ? (data.estimate = estimate) : (data.estimate = null);

				const { tenantId } = this._store.user;
				const { id: organizationId } = this._organization;
				const payload = Object.assign(data, {
					organizationId,
					tenantId
				});
				this._tasksService
					.createTask(payload)
					.pipe(
						tap(() => this._reload()),
						untilDestroyed(this)
					)
					.subscribe();
			}
		}
	}

	public get organizationId(): ID | null {
		return this._organization?.id ?? null;
	}

	public get tenantId(): ID | null {
		return this._organization?.tenantId ?? null;
	}

	/** Heading of the task drawer, as on the Tasks pages. */
	public get taskDrawerHeading(): string {
		return this.isMyTask ? 'TASKS_PAGE.MY_TASK_HEADER' : 'TASKS_PAGE.HEADER';
	}

	/**
	 * Opens the task's quick look straight away from the row's data, then swaps in the full
	 * record (description, members, sprints…) once it has loaded.
	 */
	public async openTask(task: ITask): Promise<void> {
		this.closeProject();
		const sequence = ++this._viewSequence;
		this._showTask(task);
		try {
			const full = await this._tasksService.getById(task.id, TASK_VIEW_RELATIONS);
			if (sequence === this._viewSequence && this.viewedTask?.id === task.id && full) {
				this._showTask(full);
			}
		} catch {
			// The row's own data stays on screen.
		}
	}

	public closeTask(): void {
		this._viewSequence++;
		this.viewedTask = null;
	}

	private _showTask(task: ITask): void {
		this.viewStatus = taskStatusOf(task);
		this.viewSections = buildTaskViewSections(task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this._hashPipe.transform(value)
		});
		this.viewedTask = task;
	}

	public openProject(project: IOrganizationProject): void {
		if (!project?.id) {
			return;
		}
		this.closeTask();
		this.viewedProject = {
			id: project.id,
			name: project.name,
			imageUrl: project.imageUrl,
			initials: this._initials(project.name)
		};
	}

	public closeProject(): void {
		this.viewedProject = null;
	}

	/** "Gauzy Web App" → "GW". */
	private _initials(name: string): string {
		const words = (name || '').trim().split(/\s+/).filter(Boolean);
		return words
			.slice(0, 2)
			.map((word) => word.charAt(0).toUpperCase())
			.join('');
	}

	public redirectToProjects(): void {
		this._router.navigate(['/pages/organization/projects']);
	}

	public redirectToTasks(): void {
		this._router.navigate([this.isMyTask ? '/pages/tasks/me' : '/pages/tasks/dashboard']);
	}

	public redirectToMyTasks(): void {
		this._router.navigate(['/pages/tasks/me']);
	}

	ngOnDestroy(): void {}
}
