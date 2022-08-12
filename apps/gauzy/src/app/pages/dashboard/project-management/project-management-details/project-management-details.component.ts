import { Component, OnDestroy, OnInit } from '@angular/core';
import { ServerDataSource } from './../../../../@core/utils/smart-table';
import {
	IOrganization,
	IOrganizationProject,
	ISelectedEmployee,
	ITask,
	TaskStatusEnum
} from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import {
	API_PREFIX,
	ErrorHandlingService,
	Store,
	TasksService
} from 'apps/gauzy/src/app/@core';
import {
	combineLatest,
	debounceTime,
	filter,
	first,
	firstValueFrom,
	Subject
} from 'rxjs';
import { tap } from 'rxjs/operators';
import { distinctUntilChange } from 'packages/common-angular/dist';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from 'apps/gauzy/src/app/@shared/pagination/pagination-filter-base.component';
import { TranslateService } from '@ngx-translate/core';
import { pluck } from 'underscore';
import { NbDialogService } from '@nebular/theme';
import { AddTaskDialogComponent } from 'apps/gauzy/src/app/@shared/tasks/add-task-dialog/add-task-dialog.component';
import { MyTaskDialogComponent } from '../../../tasks/components/my-task-dialog/my-task-dialog.component';
import { Router } from '@angular/router';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-project-management-details',
	templateUrl: './project-management-details.component.html',
	styleUrls: ['./project-management-details.component.scss']
})
export class ProjectManagementDetailsComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy
{
	private _smartTableSource: ServerDataSource;
	private _tasks: ITask[] = [];
	private _selectedEmployee: ISelectedEmployee;
	private _selectedProject: IOrganizationProject;
	private _organization: IOrganization;
	private _task$: Subject<any> = this.subject$;
	private _settingsSmartTable: object;
	private _projects: IOrganizationProject[] = [];
	public status = TaskStatusEnum;

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
		combineLatest([storeEmployee$, storeOrganization$, storeProject$])
			.pipe(
				debounceTime(300),
				filter(
					([organization, employee]) => !!organization && !!employee
				),
				distinctUntilChange(),
				tap(([employee, organization, project]) => {
					this._organization = organization;
					this._selectedEmployee = employee;
					this._selectedProject = project;
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
		this._loadSmartTableSettings();
	}

	private _setSmartTableSource() {
		if (!this._organization) {
			return;
		}
		const { tenantId } = this._store.user;
		const { id: organizationId } = this._organization;
		const request = {};
		const relations = [];
		let endPoint: string = `${API_PREFIX}/tasks/pagination`;
		relations.push(...['project', 'tags']);

		if (this.isSelectedEmployee) {
			request['employeeId'] = this._selectedEmployee.id;
			endPoint = `${API_PREFIX}/tasks/employee`;
		}

		if (this._selectedProject && this._selectedProject.id) {
			request['projectId'] = this._selectedProject.id;
		}

		this._smartTableSource = new ServerDataSource(this._httpClient, {
			endPoint,
			relations,
			where: {
				...{ organizationId, tenantId },
				...request,
				...this.filters.where
			},
			resultMap: (task: ITask) => {
				return Object.assign({}, task, { ...task });
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this._smartTableSource.count()
				});
			}
		});
	}

	private async _getTasks() {
		if (!this._organization) {
			return;
		}
		try {
			this._setSmartTableSource();
			const { activePage, itemsPerPage } = this.pagination;
			this._smartTableSource.setPaging(activePage, itemsPerPage, false);
			this._smartTableSource.setSort([
				{ field: 'dueDate', direction: 'asc' }
			]);
			await this._smartTableSource.getElements();
			this._tasks.push(...this._smartTableSource.getData());
			this._sortProjectByPopularity();
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this._settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination
					? pagination.itemsPerPage
					: this.minItemPerPage
			}
		};
	}

	private _sortProjectByPopularity() {
		const count = {};
		const projects = pluck(this.tasks, 'project');
		projects.forEach(({ id }) => {
			count[id] = (count[id] || 0) + 1;
		});
		this.projects = projects.filter(
			(value, index, self) =>
				index === self.findIndex(({ id }) => id === value.id)
		);
		this.projects.sort(
			(current, next) => -(count[current.id] - count[next.id])
		);
	}

	private get _isMyTask() {
		return this._selectedEmployee.id === this._store.user.employeeId;
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

	public get isSelectedEmployee(): boolean {
		return this._selectedEmployee && this._selectedEmployee.id
			? true
			: false;
	}

	public get projects(): IOrganizationProject[] {
		return this._projects;
	}

	public set projects(value: IOrganizationProject[]) {
		this._projects = value;
	}

	public get assigned(): ITask[] {
		return this.tasks.filter(({ status }) => status === this.status.TODO);
	}

	public async addTodo() {
		let dialog: any;
		if (!this._isMyTask) {
			dialog = this._dialogService.open(AddTaskDialogComponent, {
				context: {
					selectedTask: this.isSelectedEmployee
						? ({
								members: [{ ...this._selectedEmployee }] as any,
								status: this.status.TODO
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
			const data: any = await firstValueFrom(
				dialog.onClose.pipe(first())
			);
			if (data) {
				const { estimateDays, estimateHours, estimateMinutes } = data;
				const estimate =
					estimateDays * 24 * 60 * 60 +
					estimateHours * 60 * 60 +
					estimateMinutes * 60;

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
