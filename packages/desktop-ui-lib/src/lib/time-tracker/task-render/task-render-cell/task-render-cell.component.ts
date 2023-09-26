import { Component } from '@angular/core';
import { TaskRenderComponent } from '../task-render.component';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ITaskPriority, ITaskSize } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-task-render-cell',
	templateUrl: './task-render-cell.component.html',
	styleUrls: ['./task-render-cell.component.scss'],
})
export class TaskRenderCellComponent extends TaskRenderComponent {
	public get title(): string {
		return this.task.title;
	}

	public get number(): string {
		return `#${this.task.taskNumber || this.buildTaskNumber()}`;
	}

	public get size(): ITaskSize {
		return this.task.taskSize;
	}

	public get priority(): ITaskPriority {
		return this.task.taskPriority;
	}

	public get isSelected$(): Observable<boolean> {
		return this.task$.pipe(
			map((task) => task?.isSelected),
			untilDestroyed(this)
		);
	}

	private buildTaskNumber() {
		if (!this.task.prefix || !this.task.number) return;
		return this.task.prefix
			.concat('-')
			.concat(String(this.task.number))
			.toUpperCase();
	}
}
