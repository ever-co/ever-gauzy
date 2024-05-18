import { AfterViewInit, Component, EventEmitter, ViewChild } from '@angular/core';
import { TaskRenderComponent } from '../task-render.component';
import { progressStatus } from '@gauzy/ui-sdk/common';
import { TaskEstimateComponent } from '../task-estimate/task-estimate.component';
import { Observable, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { map } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-task-progress',
	templateUrl: './task-progress.component.html',
	styleUrls: ['./task-progress.component.scss']
})
export class TaskProgressComponent extends TaskRenderComponent implements AfterViewInit {
	public updated: EventEmitter<number>;

	constructor() {
		super();
		this.updated = new EventEmitter<number>();
		this._taskEstimate = null;
	}

	private _taskEstimate: TaskEstimateComponent;

	public get taskEstimate(): TaskEstimateComponent {
		return this._taskEstimate;
	}

	@ViewChild('taskEstimate')
	public set taskEstimate(value: TaskEstimateComponent) {
		if (value) {
			this._taskEstimate = value;
		}
	}

	public get progressStatus() {
		return progressStatus;
	}

	public get progress$(): Observable<number> {
		return this.task$.pipe(
			map((task) => {
				if (this.task?.estimate === 0) {
					return 0;
				}
				if (this.task?.duration > this.task?.estimate) {
					return 100;
				}
				return Math.floor((this.task?.duration / this.task?.estimate) * 100);
			}),
			untilDestroyed(this)
		);
	}

	public ngAfterViewInit(): void {
		this.taskEstimate?.edited
			.pipe(
				tap((estimate: number) => {
					this.rowData = {
						...this.task,
						estimate
					};
					this.updated.emit(estimate);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
