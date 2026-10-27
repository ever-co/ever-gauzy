import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { combineLatest, debounceTime, filter, first, firstValueFrom, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { pluck } from 'underscore';
import {
	ID,
	IOrganization,
	IOrganizationProject,
	ISelectedEmployee,
	ITask,
	PermissionsEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { ErrorHandlingService, ServerDataSource, Store, TasksService } from '@gauzy/ui-core/core';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import { AddTaskDialogComponent, PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';
import { MyTaskDialogComponent } from '../../../tasks/components/my-task-dialog/my-task-dialog.component';

/** Colour family of a status pill; each maps to one of the gauzy action accents in the stylesheet. */
export type TaskStatusTone = 'success' | 'info' | 'warning' | 'danger' | 'muted' | 'neutral';

/** How close a task is to its due date; `null` when it has none or is already closed. */
export type TaskDueState = 'overdue' | 'today' | 'soon' | null;

const CLOSED_STATUSES: string[] = [TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED];
const DUE_SOON_DAYS = 3;

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

	constructor(
		readonly translateService: TranslateService,
		private readonly _httpClient: HttpClient,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _dialogService: NbDialogService,
		private readonly _tasksService: TasksService,
		private readonly _router: Router
	) {
		super(translateService);
	}

	ngOnInit(): void {
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
			...(this.filters.where ? this.filters.where : {})
		};
	}

	/*
	 * Register Smart Table Source Config
	 */
	private _setSmartTableSource() {
		if (!this._organization) {
			return;
		}
		this._smartTableSource = new ServerDataSource(this._httpClient, {
			endPoint: this._endPoint,
			relations: ['project', 'tags'],
			where: this._buildWhere()
		});
	}

	private async _getTasks() {
		if (!this._organization) {
			return;
		}
		this.tasksLoading = true;
		try {
			this._setSmartTableSource();
			const { activePage, itemsPerPage } = this.getPagination();

			this._smartTableSource.setPaging(activePage, itemsPerPage, false);
			this._smartTableSource.setSort([{ field: 'dueDate', direction: 'asc' }]);

			await this._smartTableSource.getElements();
			this._tasks.push(...this._smartTableSource.getData());
			this.totalTasks = this._smartTableSource.count();
			this._sortProjectByPopularity();
		} catch (error) {
			this._errorHandlingService.handleError(error);
		} finally {
			this.tasksLoading = false;
		}
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

	public onScrollTasks(): void {
		if (this.tasksLoading || this.tasks.length >= this.totalTasks) {
			return;
		}
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
