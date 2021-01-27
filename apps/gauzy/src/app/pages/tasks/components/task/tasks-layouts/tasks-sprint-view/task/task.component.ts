import {
	Component,
	Input,
	EventEmitter,
	Output,
	OnInit,
	OnDestroy
} from '@angular/core';
import { ITask, IEmployee, TaskStatusEnum } from '@gauzy/contracts';
import { NbMenuService } from '@nebular/theme';
import { tap, filter, map, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-sprint-task',
	templateUrl: './task.component.html',
	styleUrls: ['./task.component.css']
})
export class SprintTaskComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() task: ITask & { employees: IEmployee[] };
	@Output() taskActionEvent: EventEmitter<{
		action: string;
		task: ITask;
	}> = new EventEmitter();
	@Output() changeStatusEvent: EventEmitter<
		Partial<ITask>
	> = new EventEmitter();
	taskStatusList: any;
	taskActions: any;
	private onDestroy$ = new Subject<void>();

	constructor(
		private nbMenuService: NbMenuService,
		readonly translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit(): void {
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

	ngOnDestroy() {
		this.onDestroy$.next();
		this.onDestroy$.complete();
	}
}
