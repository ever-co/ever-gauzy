import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { combineLatest, firstValueFrom, Observable, Subject } from 'rxjs';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ErrorHandlingService,
	MyTasksStoreService,
	ServerDataSource,
	Store,
	TasksStoreService,
	TeamTasksStoreService
} from '@gauzy/ui-core/core';
import {
	AddTaskDialogComponent,
	ALL_PROJECT_SELECTED,
	AssignedToComponent,
	CreateByComponent,
	CreatedAtComponent,
	DateViewComponent,
	DeleteConfirmationComponent,
	EmployeesMergedTeamsComponent,
	HashNumberPipe,
	InputFilterComponent,
	IPaginationBase,
	NotesWithTagsComponent,
	OrganizationTeamFilterComponent,
	PaginationFilterBaseComponent,
	ProjectComponent,
	StatusViewComponent,
	TaskStatusFilterComponent
} from '@gauzy/ui-core/shared';
import {
	ComponentLayoutStyleEnum,
	ID,
	IOrganization,
	IOrganizationProject,
	ISelectedEmployee,
	ITask,
	PermissionsEnum,
	TaskListTypeEnum
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import { MyTaskDialogComponent } from './../my-task-dialog/my-task-dialog.component';
import { TeamTaskDialogComponent } from '../team-task-dialog/team-task-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-tasks',
	templateUrl: './task.component.html',
	styleUrls: ['task.component.scss']
})
export class TaskComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	private _refresh$: Subject<boolean> = new Subject();
	private _tasks: ITask[] = [];
	settingsSmartTable: object;
	loading: boolean = false;
	disableButton: boolean = true;
	smartTableSource: ServerDataSource;
	availableTasks$: Observable<ITask[]>;
	tasks$: Observable<ITask[]> = this._taskStore.tasks$;
	myTasks$: Observable<ITask[]> = this._myTaskStore.myTasks$;
	teamTasks$: Observable<ITask[]> = this._teamTaskStore.tasks$;
	selectedTask: ITask;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public organization: IOrganization;
	viewMode: TaskListTypeEnum = TaskListTypeEnum.GRID;
	taskListTypeEnum = TaskListTypeEnum;
	defaultProject = ALL_PROJECT_SELECTED;
	taskSubject$: Subject<boolean> = this.subject$;
	selectedEmployee: ISelectedEmployee;
	selectedEmployeeId: ID;
	selectedProject: IOrganizationProject;
	selectedTeamIds: string[] = [];

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly _taskStore: TasksStoreService,
		private readonly _myTaskStore: MyTasksStoreService,
		private readonly _teamTaskStore: TeamTasksStoreService,
		public readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _store: Store,
		private readonly route: ActivatedRoute,
		private readonly httpClient: HttpClient,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _hashNumberPipe: HashNumberPipe
	) {
		super(translateService);
		this.initTasks();
		this.setView();
	}

	/**
	 * If, default project is selected from header
	 *
	 * @returns
	 */
	get isDefaultProject() {
		if (this.selectedProject) {
			return this.selectedProject.id === this.defaultProject.id;
		}
		return true;
	}

	/**
	 * return store instance as per page
	 */
	get storeInstance() {
		if (this.isTasksPage()) {
			return this._taskStore;
		} else if (this.isMyTasksPage()) {
			return this._myTaskStore;
		} else if (this.isTeamTaskPage()) {
			return this._teamTaskStore;
		}
	}

	private initTasks(): void {
		const path = this._activatedRoute.snapshot.url[0].path;
		if (path === 'me') {
			this.viewComponentName = ComponentEnum.MY_TASKS;
			this.availableTasks$ = this.myTasks$;
			return;
		}
		if (path === 'team') {
			this.viewComponentName = ComponentEnum.TEAM_TASKS;
			this.availableTasks$ = this.teamTasks$;
			return;
		}
		this.viewComponentName = ComponentEnum.ALL_TASKS;
		this.availableTasks$ = this.tasks$;
		return;
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.TASK'),
			columns: {
				taskNumber: {
					title: this.getTranslation('TASKS_PAGE.TASK_ID'),
					type: 'string',
					width: '10%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (prefix: string) => {
						this.setFilter({ field: 'prefix', search: prefix });
					},
					valuePrepareFunction: (value: string, cell: Cell) => {
						return this._hashNumberPipe.transform(value);
					}
				},
				description: {
					title: this.getTranslation('TASKS_PAGE.TASKS_TITLE'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent,
					componentInitFunction: (instance: NotesWithTagsComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'title', search: value });
					}
				},
				project: {
					title: this.getTranslation('TASKS_PAGE.TASKS_PROJECT'),
					type: 'custom',
					isFilterable: false,
					renderComponent: ProjectComponent,
					componentInitFunction: (instance: ProjectComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					}
				},
				createdAt: {
					title: this.getTranslation('SM_TABLE.CREATED_AT'),
					type: 'custom',
					isFilterable: false,
					renderComponent: CreatedAtComponent,
					componentInitFunction: (instance: CreatedAtComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				creator: {
					title: this.getTranslation('TASKS_PAGE.TASKS_CREATOR'),
					type: 'custom',
					renderComponent: CreateByComponent,
					componentInitFunction: (instance: CreateByComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({
							field: 'creator.firstName',
							search: value
						});
					}
				},
				...this.getColumnsByPage(),
				dueDate: {
					title: this.getTranslation('TASKS_PAGE.DUE_DATE'),
					type: 'custom',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'dueDate', search: value });
					},
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					}
				},
				status: {
					title: this.getTranslation('TASKS_PAGE.TASKS_STATUS'),
					type: 'custom',
					width: '10%',
					renderComponent: StatusViewComponent,
					componentInitFunction: (instance: StatusViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					},
					filter: {
						type: 'custom',
						component: TaskStatusFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'status', search: value?.name });
					}
				}
			}
		};
	}

	private getColumnsByPage() {
		if (this.isTasksPage()) {
			return {
				employeesMergedTeams: {
					title:
						this.getTranslation('TASKS_PAGE.TASK_MEMBERS') +
						'/' +
						this.getTranslation('TASKS_PAGE.TASK_TEAMS'),
					type: 'custom',
					isFilterable: false,
					renderComponent: EmployeesMergedTeamsComponent,
					componentInitFunction: (instance: EmployeesMergedTeamsComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
						instance.rowData = cell.getRow().getData();
					}
				}
			};
		} else if (this.isMyTasksPage()) {
			return {
				assignTo: {
					title: this.getTranslation('TASKS_PAGE.TASK_ASSIGNED_TO'),
					type: 'custom',
					isFilterable: false,
					renderComponent: AssignedToComponent,
					componentInitFunction: (instance: AssignedToComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					}
				}
			};
		} else if (this.isTeamTaskPage()) {
			return {
				assignTo: {
					title: this.getTranslation('TASKS_PAGE.TASK_ASSIGNED_TO'),
					type: 'custom',
					width: '12%',
					renderComponent: AssignedToComponent,
					componentInitFunction: (instance: AssignedToComponent, cell: Cell) => {
						instance.value = cell.getValue();
						instance.rowData = cell.getRow().getData();
					},
					filter: {
						type: 'custom',
						component: OrganizationTeamFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({
							field: 'teams',
							search: value ? [value.id] : []
						});
					}
				}
			};
		} else {
			return {};
		}
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.taskSubject$
			.pipe(
				debounceTime(400),
				tap(() => this.clearItem()),
				tap(() => this.getTasks()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.taskSubject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;
		const storeProject$ = this._store.selectedProject$;
		const storeTeam$ = this._store.selectedTeam$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$, storeTeam$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee, project, team]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee?.id || null;
					this.selectedProject = project;
					this.selectedTeamIds = team?.id ? [team.id] : [];
					this.viewMode = project?.taskListType || TaskListTypeEnum.GRID;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.taskSubject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.createTaskDialog()),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this._tasks = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this._store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this._tasks = [])),
				tap(() => this.taskSubject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		this.loading = true;

		const { tenantId } = this._store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			...(this.viewComponentName === ComponentEnum.ALL_TASKS
				? { endPoint: `${API_PREFIX}/tasks/pagination` }
				: {}),
			...(this.viewComponentName === ComponentEnum.TEAM_TASKS ? { endPoint: `${API_PREFIX}/tasks/team` } : {}),
			...(this.viewComponentName === ComponentEnum.MY_TASKS ? { endPoint: `${API_PREFIX}/tasks/me` } : {}),
			relations: [
				'members',
				'members.user',
				'project',
				'tags',
				'teams',
				'teams.members',
				'teams.members.employee',
				'teams.members.employee.user',
				'creator',
				'organizationSprint',
				'taskStatus',
				'taskSize',
				'taskPriority'
			],
			join: {
				alias: 'task',
				leftJoin: {
					members: 'task.members',
					user: 'members.user'
				}
			},
			where: {
				organizationId,
				tenantId,
				...(this.selectedProject && this.selectedProject.id
					? {
							...(this.viewMode === TaskListTypeEnum.SPRINT
								? {
										organizationSprintId: null
								  }
								: {}),
							projectId: this.selectedProject.id
					  }
					: {}),
				...(this.selectedEmployeeId
					? {
							members: {
								id: this.selectedEmployeeId
							}
					  }
					: {}),
				...(this.selectedTeamIds ? { teams: this.selectedTeamIds } : {}),
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (task: ITask) => {
				return Object.assign({}, task, {
					employees: task.members ? task.members : undefined,
					assignTo: this._teamTaskStore._getTeamNames(task),
					employeesMergedTeams: [task.members, task.teams]
				});
			},
			finalize: () => {
				this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID
					? this._tasks.push(...this.smartTableSource.getData())
					: (this._tasks = this.smartTableSource.getData());
				this.storeInstance.loadAllTasks(this._tasks);
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	async getTasks() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.pagination;
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			if (
				this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID ||
				this.viewMode === TaskListTypeEnum.SPRINT
			) {
				await this.smartTableSource.getElements();
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	async createTaskDialog() {
		let dialog;
		if (this.isTasksPage()) {
			dialog = this.dialogService.open(AddTaskDialogComponent, {
				context: {}
			});
		} else if (this.isMyTasksPage()) {
			dialog = this.dialogService.open(MyTaskDialogComponent, {
				context: {}
			});
		} else if (this.isTeamTaskPage()) {
			dialog = this.dialogService.open(TeamTaskDialogComponent, {
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
				const { id: organizationId } = this.organization;
				const payload = Object.assign(data, {
					organizationId,
					tenantId
				});
				this.storeInstance
					.createTask(payload)
					.pipe(
						tap(() => this._refresh$.next(true)),
						tap(() => this.taskSubject$.next(true)),
						untilDestroyed(this)
					)
					.subscribe();
			}
		}
	}

	async editTaskDialog(selectedItem?: ITask) {
		if (selectedItem) {
			this.selectTask({
				isSelected: true,
				data: selectedItem
			});
		}
		let dialog;
		if (this.isTasksPage()) {
			dialog = this.dialogService.open(AddTaskDialogComponent, {
				context: {
					selectedTask: this.selectedTask
				}
			});
		} else if (this.isMyTasksPage()) {
			dialog = this.dialogService.open(MyTaskDialogComponent, {
				context: {
					selectedTask: this.selectedTask
				}
			});
		} else if (this.isTeamTaskPage()) {
			dialog = this.dialogService.open(TeamTaskDialogComponent, {
				context: {
					selectedTask: this.selectedTask
				}
			});
		}
		if (dialog) {
			const data: any = await firstValueFrom(dialog.onClose.pipe(first()));

			if (data) {
				const { estimateDays, estimateHours, estimateMinutes } = data;

				const estimate = estimateDays * 24 * 60 * 60 + estimateHours * 60 * 60 + estimateMinutes * 60;

				estimate ? (data.estimate = estimate) : (data.estimate = null);

				const { tenantId } = this._store.user;
				const { id: organizationId } = this.organization;
				const payload = Object.assign(data, {
					organizationId,
					tenantId
				});

				this.storeInstance
					.editTask({ ...payload, id: this.selectedTask.id })
					.pipe(
						tap(() => this._refresh$.next(true)),
						tap(() => this.taskSubject$.next(true)),
						untilDestroyed(this)
					)
					.subscribe();
			}
		}
	}

	async duplicateTaskDialog(selectedItem?: ITask) {
		if (selectedItem) {
			this.selectTask({
				isSelected: true,
				data: selectedItem
			});
		}
		let dialog;
		if (this.isTasksPage()) {
			dialog = this.dialogService.open(AddTaskDialogComponent, {
				context: {
					selectedTask: this.selectedTask
				}
			});
		} else if (this.isMyTasksPage()) {
			const selectedTask: ITask = Object.assign({}, this.selectedTask);
			// while duplicate my task, default selected employee should be logged in employee
			selectedTask.members = null;
			dialog = this.dialogService.open(MyTaskDialogComponent, {
				context: {
					selectedTask: selectedTask
				}
			});
		} else if (this.isTeamTaskPage()) {
			dialog = this.dialogService.open(TeamTaskDialogComponent, {
				context: {
					selectedTask: this.selectedTask
				}
			});
		}
		if (dialog) {
			const data: any = await firstValueFrom(dialog.onClose.pipe(first()));

			if (data) {
				const { estimateDays, estimateHours, estimateMinutes } = data;
				const estimate = estimateDays * 24 * 60 * 60 + estimateHours * 60 * 60 + estimateMinutes * 60;

				estimate ? (data.estimate = estimate) : (data.estimate = null);

				const { tenantId } = this._store.user;
				const { id: organizationId } = this.organization;
				const payload = Object.assign(data, {
					organizationId,
					tenantId
				});
				this.storeInstance
					.createTask(payload)
					.pipe(
						tap(() => this._refresh$.next(true)),
						tap(() => this.taskSubject$.next(true)),
						untilDestroyed(this)
					)
					.subscribe();
			}
		}
	}

	async deleteTask(selectedItem?: ITask) {
		if (selectedItem) {
			this.selectTask({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose.pipe(first()));
		if (result) {
			this.storeInstance
				.delete(this.selectedTask.id)
				.pipe(
					tap(() => this._refresh$.next(true)),
					tap(() => this.taskSubject$.next(true)),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	selectTask({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedTask = isSelected ? data : null;
	}

	isTasksPage() {
		return this.viewComponentName === ComponentEnum.ALL_TASKS;
	}

	isMyTasksPage() {
		return this.viewComponentName === ComponentEnum.MY_TASKS;
	}

	isTeamTaskPage() {
		return this.viewComponentName === ComponentEnum.TEAM_TASKS;
	}

	/**
	 * Open task settings page for a specific project.
	 *
	 * @param selectedProject - The project for which the task settings page should be opened.
	 */
	openTasksSettings(selectedProject: IOrganizationProject): void {
		if (
			this.isDefaultProject ||
			!this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
		) {
			return;
		}

		this._router.navigate(['/pages/tasks/settings', selectedProject.id], {
			state: selectedProject
		});
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectTask({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy(): void {}
}
