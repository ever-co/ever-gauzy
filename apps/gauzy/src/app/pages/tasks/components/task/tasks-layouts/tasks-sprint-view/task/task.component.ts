import {
	Component,
	Input,
	EventEmitter,
	Output,
	OnInit,
	OnDestroy
} from '@angular/core';
import { Task, Employee, TaskStatusEnum } from '@gauzy/models';
import { NbMenuService } from '@nebular/theme';
import { tap, filter, map, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-sprint-task',
	templateUrl: './task.component.html',
	styleUrls: ['./task.component.css']
})
export class SprintTaskComponent implements OnInit, OnDestroy {
	@Input() task: Task & { employees: Employee[] };
	@Output() taskActionEvent: EventEmitter<{
		action: string;
		task: Task;
	}> = new EventEmitter();
	@Output() changeStatusEvent: EventEmitter<
		Partial<Task>
	> = new EventEmitter();
	taskStatusList: any;
	taskActions: any;
	private onDestroy$ = new Subject<void>();
	constructor(private nbMenuService: NbMenuService) {}

	ngOnInit(): void {
		this.taskActions = [
			{ title: 'Add task', action: 'ADD_TASK' },
			{ title: 'Edit task', action: 'EDIT_TASK' },
			{ title: 'Delete task', action: 'DELETE_TASK' }
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

	changeStatus(evt: Partial<Task>): void {
		this.changeStatusEvent.emit(evt);
	}

	ngOnDestroy() {
		this.onDestroy$.next();
		this.onDestroy$.complete();
	}
}
