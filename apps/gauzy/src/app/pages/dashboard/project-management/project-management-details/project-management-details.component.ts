import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { combineLatest, debounceTime, filter, first, firstValueFrom, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pluck } from 'underscore';
import { NbDialogService } from '@nebular/theme';
import { ErrorHandlingService, ServerDataSource } from '@gauzy/ui-sdk/core';
import {
	IOrganization,
	IOrganizationProject,
	ISelectedEmployee,
	ITask,
	PermissionsEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { Store } from '@gauzy/ui-sdk/common';
import { TasksService } from '@gauzy/ui-sdk/core';
import { PaginationFilterBaseComponent } from './../../../../@shared/pagination/pagination-filter-base.component';
import { AddTaskDialogComponent } from './../../../../@shared/tasks/add-task-dialog/add-task-dialog.component';
import { MyTaskDialogComponent } from '../../../tasks/components/my-task-dialog/my-task-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-project-management-details',
	templateUrl: './project-management-details.component.html',
	styleUrls: ['./project-management-details.component.scss']
})
export class ProjectManagementDetailsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	private _smartTableSource: ServerDataSource;
	private _tasks: ITask[] = [];
	private _selectedEmployee: ISelectedEmployee;
	public selectedEmployeeId: ISelectedEmployee['id'];
	private selectedProjectId: IOrganizationProject['id'];
	private _organization: IOrganization;
	private _task$: Subject<boolean> = this.subject$;
	private _projects: IOrganizationProject[] = [];
	public status = TaskStatusEnum;
	public readonly permissions = PermissionsEnum;

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
				tap(() => {
					this.refreshPagination();
					this.tasks = [];
					this._task$.next(true);
				}),
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

	/*
	 * Register Smart Table Source Config
	 */
	private _setSmartTableSource() {
		if (!this._organization) {
			return;
		}
		const { id: organizationId, tenantId } = this._organization;

		this._smartTableSource = new ServerDataSource(this._httpClient, {
			...(this.selectedEmployeeId
				? {
						endPoint: `${API_PREFIX}/tasks/employee`
				  }
				: {
						endPoint: `${API_PREFIX}/tasks/pagination`
				  }),
			relations: ['project', 'tags'],
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployeeId
					? {
							employeeId: this.selectedEmployeeId
					  }
					: {}),
				...(this.selectedProjectId
					? {
							projectId: this.selectedProjectId
					  }
					: {}),
				...(this.filters.where ? this.filters.where : {})
			}
		});
	}

	private async _getTasks() {
		if (!this._organization) {
			return;
		}
		try {
			this._setSmartTableSource();
			const { activePage, itemsPerPage } = this.getPagination();

			this._smartTableSource.setPaging(activePage, itemsPerPage, false);
			this._smartTableSource.setSort([{ field: 'dueDate', direction: 'asc' }]);

			await this._smartTableSource.getElements();
			this._tasks.push(...this._smartTableSource.getData());
			this._sortProjectByPopularity();
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	private _sortProjectByPopularity() {
		const count = {};
		const projects = pluck(this.tasks, 'project').filter(Boolean);

		projects.forEach(({ id }) => {
			count[id] = (count[id] || 0) + 1;
		});
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
						tap(() => this.refreshPagination()),
						tap(() => (this.tasks = [])),
						tap(() => this._task$.next(true)),
						untilDestroyed(this)
					)
					.subscribe();
			}
		}
	}

	public redirectToProjects(): void {
		this._router.navigate(['/pages/organization/projects']);
	}

	public redirectToMyTasks(): void {
		this._router.navigate(['/pages/tasks/me']);
	}

	ngOnDestroy(): void {}
}
