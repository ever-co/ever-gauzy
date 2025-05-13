import { Component, EventEmitter, Input } from '@angular/core';
import { ITaskRender } from '../task-render.component';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TaskStatusEnum } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-task-estimate',
    templateUrl: './task-estimate.component.html',
    styleUrls: ['./task-estimate.component.scss'],
    standalone: false
})
export class TaskEstimateComponent {
	public isEdit = false;
	public edited: EventEmitter<number>;
	@Input()
	public task$: Observable<ITaskRender>;

	constructor() {
		this.edited = new EventEmitter<number>();
	}

	public get estimate$(): Observable<number> {
		return this.task$.pipe(
			map((task: ITaskRender) => task?.estimate),
			untilDestroyed(this)
		);
	}

	public get isEditDisabled$(): Observable<boolean> {
		return this.task$.pipe(
			map(
				(task: ITaskRender) => task?.status === TaskStatusEnum.COMPLETED
			),
			untilDestroyed(this)
		);
	}

	public update(event: number): void {
		this.isEdit = false;
		if (isNaN(Number(event))) return;
		this.edited.emit(event);
	}
}
