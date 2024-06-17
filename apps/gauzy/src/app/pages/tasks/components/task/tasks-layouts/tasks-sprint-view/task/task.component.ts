import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import {
	IOrganization,
	IOrganizationProject,
	IPagination,
	ITask,
	ITaskStatus,
	ITaskStatusFindInput,
	TaskStatusEnum
} from '@gauzy/contracts';
import { NbMenuService } from '@nebular/theme';
import { filter, map, takeUntil, tap } from 'rxjs/operators';
import { combineLatest, debounceTime, Subject } from 'rxjs';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { TaskStatusesService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-sprint-task',
	templateUrl: './task.component.html',
	styleUrls: ['./task.component.scss']
})
export class SprintTaskComponent extends TranslationBaseComponent implements OnInit, AfterViewInit, OnDestroy {
	private onDestroy$ = new Subject<void>();
	private subject$: Subject<boolean> = new Subject();
	private organization: IOrganization;
	private projectId: IOrganizationProject['id'];
	@Input() task: any;
	@Input() isSelected = false;
	@Output() taskActionEvent: EventEmitter<{
		action: string;
		task: ITask;
	}> = new EventEmitter();
	@Output() changeStatusEvent: EventEmitter<Partial<ITask>> = new EventEmitter();
	taskStatusList: any;
	taskActions: any;
	public statuses$: BehaviorSubject<ITaskStatus[]> = new BehaviorSubject([]);

	constructor(
		private readonly nbMenuService: NbMenuService,
		public readonly translate: TranslateService,
		private readonly store: Store,
		private readonly taskStatusesService: TaskStatusesService
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getStatuses()),
				untilDestroyed(this)
			)
			.subscribe();
		this.taskActions = [
			{
				title: this.getTranslation('TASKS_PAGE.EDIT_TASK'),
				action: 'EDIT_TASK'
			},
			{
				title: this.getTranslation('TASKS_PAGE.DELETE_TASK'),
				action: 'DELETE_TASK'
			}
		];

		this.taskStatusList = this.getStatusList(this.task.status);
		this.nbMenuService
			.onItemClick()
			.pipe(
				map(({ tag, item }) => {
					const [action, id] = tag.split(':');
					return { action, id, item };
				}),
				filter(({ id }) => id === this.task.id),
				tap(({ action, item }: { action: string; item: any }) => {
					switch (action) {
						case 'changeStatus':
							this.changeStatusEvent.emit({
								status: item.title,
								id: this.task.id,
								title: this.task.title
							});
							break;
						case 'updateTask':
							this.taskActionEvent.emit({
								action: item.action,
								task: this.task
							});
					}
				}),
				takeUntil(this.onDestroy$)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeProject$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, project]) => {
					this.organization = organization;
					this.projectId = project ? project.id : null;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getStatusList(filterOption: string): { title: TaskStatusEnum }[] {
		return Object.values(TaskStatusEnum)
			.filter((status) => status !== filterOption)
			.map((status: TaskStatusEnum) => ({ title: status }));
	}

	// toggleItem(item: Task): void {
	//   this.toggleItemEvent.emit(item);
	// }

	changeStatus(evt: Partial<ITask>): void {
		this.changeStatusEvent.emit(evt);
	}

	getStatuses() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.taskStatusesService
			.get<ITaskStatusFindInput>({
				tenantId,
				organizationId,
				...(this.projectId
					? {
							projectId: this.projectId
					  }
					: {})
			})
			.pipe(
				map(({ items, total }: IPagination<ITaskStatus>) => (total > 0 ? items : this.taskStatusList)),
				tap((statuses: ITaskStatus[]) => this.statuses$.next(statuses)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public updateStatus(taskStatus: ITaskStatus) {
		this.changeStatusEvent.emit({
			status: taskStatus.name as TaskStatusEnum,
			id: this.task.id,
			title: this.task.title,
			taskStatus
		});
		this.task = {
			...this.task,
			taskStatus,
			status: taskStatus.name as TaskStatusEnum
		};
	}

	ngOnDestroy() {
		this.onDestroy$.next();
		this.onDestroy$.complete();
	}
}
