import { Component, ViewChild } from '@angular/core';
import { TaskRenderComponent } from '../task-render.component';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ITaskPriority, ITaskSize } from '@gauzy/contracts';
import {NbDialogService, NbPopoverDirective} from '@nebular/theme';
import {TaskDetailComponent} from "../task-detail/task-detail.component";

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-task-render-cell',
    templateUrl: './task-render-cell.component.html',
    styleUrls: ['./task-render-cell.component.scss'],
    standalone: false
})
export class TaskRenderCellComponent extends TaskRenderComponent {
	private _popover: NbPopoverDirective;

	constructor(private _dialogService: NbDialogService) {
		super();
	}

	public get popover(): NbPopoverDirective {
		return this._popover;
	}

	@ViewChild(NbPopoverDirective)
	public set popover(value: NbPopoverDirective) {
		this._popover = value;
	}

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

	public showDetail(){
		this._dialogService.open(TaskDetailComponent, {
			context: {
				task: this.task
			},
			backdropClass: 'backdrop-blur',
		})
	}
}
