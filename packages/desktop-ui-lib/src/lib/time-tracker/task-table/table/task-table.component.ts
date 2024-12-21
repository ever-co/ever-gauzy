import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { ITask, ITaskStatus, ITaskUpdateInput, TaskStatusEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Angular2SmartTableComponent, Cell } from 'angular2-smart-table';
import { combineLatest, concatMap, Observable, tap } from 'rxjs';
import { TaskTableStore } from '../+state/task-table.store';
import { API_PREFIX } from '../../../constants';
import { ElectronService } from '../../../electron/services';
import { LanguageElectronService } from '../../../language/language-electron.service';
import { Store, TaskCacheService, ToastrNotificationService } from '../../../services';
import { ProjectSelectorService } from '../../../shared/features/project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../../../shared/features/task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../../../shared/features/team-selector/+state/team-selector.service';
import { CachedServerDataSource } from '../../../utils/smart-table/cached-server.data-source';
import { TaskDurationComponent, TaskProgressComponent } from '../../task-render';
import { TaskRenderCellComponent } from '../../task-render/task-render-cell/task-render-cell.component';
import { TaskStatusComponent } from '../../task-render/task-status/task-status.component';
import { TimeTrackerService } from '../../time-tracker.service';
import { ActionButtonStore } from '../action-button/+state/action-button.store';
import { SearchTermQuery } from '../search/+state/search-term.query';
import { SearchTermStore } from '../search/+state/search-term.store';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-task-table',
    templateUrl: './task-table.component.html',
    styleUrls: ['./task-table.component.scss'],
    standalone: false
})
export class TaskTableComponent implements OnInit, AfterViewInit {
	private _smartTable: Angular2SmartTableComponent;
	public smartTableSource: CachedServerDataSource;
	public smartTableSettings: any;
	public loading$!: Observable<boolean>;

	@ViewChild('smartTable')
	public set smartTable(content: Angular2SmartTableComponent) {
		if (content) {
			this._smartTable = content;
		}
	}
	public get smartTable(): Angular2SmartTableComponent {
		return this._smartTable;
	}

	constructor(
		private readonly translateService: TranslateService,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly toastrNotifier: ToastrNotificationService,
		private readonly languageElectronService: LanguageElectronService,
		private readonly electronService: ElectronService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly taskTableStore: TaskTableStore,
		private readonly httpClient: HttpClient,
		private readonly teamSelectorService: TeamSelectorService,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly actionButtonStore: ActionButtonStore,
		private readonly searchTermQuery: SearchTermQuery,
		private readonly searchTermStore: SearchTermStore,
		private readonly taskCacheService: TaskCacheService,
		private readonly store: Store
	) {}
	ngOnInit(): void {
		combineLatest([
			this.teamSelectorService.selected$,
			this.projectSelectorService.selected$,
			this.searchTermQuery.value$
		])
			.pipe(
				tap(() => this.setSmartTableSource()),
				untilDestroyed(this)
			)
			.subscribe();
		this.loadSmartTableSettings();
		this.setSmartTableSource();
	}

	ngAfterViewInit(): void {
		this.languageElectronService.onLanguageChange(() => {
			this.loadSmartTableSettings();
		});
		this.onChangedSource();
		this.monitorLoadingState();
	}

	private monitorLoadingState(): void {
		this.loading$ = this.smartTableSource.loading$;
	}

	public refreshTimer(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public handleRowSelection(selectionEvent): void {
		if (this.isNoRowSelected(selectionEvent)) {
			this.clearSelectedTaskAndRefresh();
		} else {
			const selectedRow = selectionEvent.data;
			this.handleSelectedTaskChange(selectedRow.id);
		}
	}

	private handleSelectedTaskChange(selectedTaskId: string): void {
		if (this.isDifferentTask(selectedTaskId)) {
			this.taskSelectorService.selected = selectedTaskId;
		}
	}

	private isDifferentTask(selectedTaskId: string): boolean {
		return this.taskSelectorService.selectedId !== selectedTaskId;
	}

	private clearSelectedTaskAndRefresh(): void {
		this.taskSelectorService.selected = null;
	}

	private isNoRowSelected({ isSelected }): boolean {
		this.actionButtonStore.update({ toggle: isSelected });
		return !isSelected;
	}

	private loadSmartTableSettings(): void {
		this.smartTableSettings = {
			columns: {
				title: {
					title: this.translateService.instant('TIMER_TRACKER.TASK'),
					type: 'custom',
					renderComponent: TaskRenderCellComponent,
					width: '40%',
					componentInitFunction: (instance: TaskRenderCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				duration: {
					title: this.translateService.instant('TIMESHEET.DURATION'),
					type: 'custom',
					renderComponent: TaskDurationComponent,
					componentInitFunction: (instance: TaskDurationComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				taskProgress: {
					title: this.translateService.instant('MENU.IMPORT_EXPORT.PROGRESS'),
					type: 'custom',
					renderComponent: TaskProgressComponent,
					width: '192px',
					componentInitFunction: (instance: TaskProgressComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.updated.subscribe({
							next: async (estimate: number) => {
								const { tenantId, organizationId } = this.store;
								const id = instance.task.id;
								const title = instance.task.title;
								const status = instance.task.status;
								const taskUpdateInput: ITaskUpdateInput = {
									organizationId,
									tenantId,
									estimate,
									status,
									title
								};
								await this.timeTrackerService.updateTask(id, taskUpdateInput);
								this.toastrNotifier.success(this.translateService.instant('TOASTR.MESSAGE.UPDATED'));
								this.refreshTimer();
							},
							error: (err: any) => {
								console.warn(err);
							}
						});
					}
				},
				taskStatus: {
					title: this.translateService.instant('SM_TABLE.STATUS'),
					type: 'custom',
					renderComponent: TaskStatusComponent,
					componentInitFunction: (instance: TaskStatusComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.updated.subscribe({
							next: async (taskStatus: ITaskStatus) => {
								const { tenantId, organizationId } = this.store;
								const id = instance.task.id;
								const title = instance.task.title;
								const status = taskStatus.name as TaskStatusEnum;
								const taskUpdateInput: ITaskUpdateInput = {
									organizationId,
									tenantId,
									status,
									title,
									taskStatus
								};
								await this.timeTrackerService.updateTask(id, taskUpdateInput);
								this.toastrNotifier.success(this.translateService.instant('TOASTR.MESSAGE.UPDATED'));
								this.refreshTimer();
							},
							error: (err: any) => {
								console.warn(err);
							}
						});
					}
				}
			},
			hideSubHeader: true,
			actions: false,
			noDataMessage: this.translateService.instant('SM_TABLE.NO_DATA.TASK'),
			pager: {
				display: false,
				perPage: 10
			}
		};
	}

	private setSmartTableSource(): void {
		const { tenantId, organizationId, user } = this.store;
		const employeeId = user?.employee?.id;

		// Validate essential IDs
		if (!tenantId || !organizationId || !employeeId) {
			console.error('Missing essential data: tenantId, organizationId, or employeeId');
			return;
		}

		// Prepare request parameters for filtering
		const { selectedId: projectId } = this.projectSelectorService;
		const { selectedId: teamId } = this.teamSelectorService;
		const { value: searchTerm } = this.searchTermQuery;

		const requestFilters = {
			tenantId,
			organizationId,
			...(projectId && { projectId }),
			...(teamId && { teams: [teamId] }),
			...(searchTerm && {
				title: searchTerm
			}),
			members: { id: employeeId }
		};

		// Initialize the smart table data source
		const source = new CachedServerDataSource(
			this.httpClient,
			{
				endPoint: `${API_PREFIX}/tasks/pagination`,
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
				order: { updatedAt: 'DESC' },
				where: requestFilters
			},
			this.taskCacheService
		);

		// Register operator to handle task responses
		source.registerOperatorFunction(concatMap((res: ITask[]) => this.mergeTaskWithStatistics(res)));

		// Assign source to the component property
		this.smartTableSource = source;
	}

	private async mergeTaskWithStatistics(tasks: ITask[]): Promise<ITask[]> {
		// Early exit if no tasks
		if (!tasks?.length) {
			this.taskTableStore.update({ data: [] });
			return [];
		}

		const { organizationId, tenantId, user } = this.store;
		const employeeId = user?.employee?.id;
		const request = {
			organizationId,
			employeeId,
			tenantId,
			projectId: this.projectSelectorService.selectedId,
			organizationTeamId: this.teamSelectorService.selectedId
		};

		try {
			const taskIds = tasks.map((task) => task.id);
			const statistics = await this.timeTrackerService.getTasksStatistics({ ...request, taskIds });
			const mergedItems = this.taskSelectorService.merge(tasks, statistics);
			this.taskTableStore.update({ data: mergedItems });
			return mergedItems;
		} catch (error) {
			console.error('Error fetching task statistics:', error);
			this.taskTableStore.update({ data: tasks });
			return tasks; // Fallback to original tasks in case of error
		}
	}

	private onChangedSource(): void {
		this.smartTable.source
			.onChanged()
			.pipe(
				tap(() => {
					this.clearItem();
					this.handleRowAutoSelection();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private handleRowAutoSelection(): void {
		const { selectedId } = this.taskSelectorService;
		if (!selectedId) return;
		const row = this.findRowById(selectedId);
		if (row) {
			this.smartTable.grid.selectRow(row);
		}
	}

	private findRowById(id: string): any {
		return this.smartTable.grid.getRows().find((row) => row.getData().id === id);
	}

	private clearItem(): void {
		if (this.smartTable && this.smartTable.grid) {
			this.smartTable.grid.dataSet['willSelect'] = 'indexed';
			this.smartTable.grid.dataSet.deselectAll();
		}
	}
}
