import { Component, EventEmitter, OnInit } from '@angular/core';
import { ITaskRender, TaskRenderComponent } from '../task-render.component';
import { ITaskStatus, TaskStatusEnum } from '@gauzy/contracts';
import { Store } from '../../../services';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-task-status',
    templateUrl: './task-status.component.html',
    styleUrls: ['./task-status.component.scss'],
    standalone: false
})
export class TaskStatusComponent extends TaskRenderComponent implements OnInit {
	public statuses$: Observable<ITaskStatus[]>;
	public updated: EventEmitter<ITaskStatus>;

	constructor(private readonly store: Store) {
		super();
		this.updated = new EventEmitter<ITaskStatus>();
	}

	public get taskStatus$(): Observable<ITaskStatus> {
		return this.task$.pipe(
			map((task: ITaskRender) => task?.taskStatus),
			untilDestroyed(this)
		);
	}

	public get status$(): Observable<string> {
		return this.task$.pipe(
			map((task: ITaskRender) => String(task?.status)),
			untilDestroyed(this)
		);
	}

	public updateStatus(taskStatus: ITaskStatus) {
		this.rowData = {
			...this.task,
			status: taskStatus.name as TaskStatusEnum,
			taskStatus,
		};
		this.updated.emit(taskStatus);
	}

	public ngOnInit(): void {
		this.statuses$ = this.store.statuses$;
	}
}
