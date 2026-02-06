import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ITaskRender } from '../task-render.component';
import { ITag, ITaskPriority, ITaskSize, ITaskStatus } from '@gauzy/contracts';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { NbDialogRef, NbCardModule } from '@nebular/theme';
import { TaskBadgeViewComponent } from '../task-badge-view/task-badge-view.component';

@Component({
    selector: 'gauzy-task-detail',
    templateUrl: './task-detail.component.html',
    styleUrls: ['./task-detail.component.scss'],
    imports: [NbCardModule, TaskBadgeViewComponent, TranslatePipe]
})
export class TaskDetailComponent {
	@Input()
	public task: ITaskRender;

	@Output()
	public hidden: EventEmitter<Boolean>;

	constructor(private _translateService: TranslateService, private _dialogRef: NbDialogRef<TaskDetailComponent>) {
		this.hidden = new EventEmitter<Boolean>();
	}

	public get title(): string {
		return this.task?.title;
	}

	public get number(): string {
		return this.task?.taskNumber;
	}

	public get tags(): ITag[] {
		return this.task?.tags;
	}

	public get description(): string {
		return (
			this.task?.description ||
			this._translateService.instant('GOALS_PAGE.NO_DESCRIPTION')
		);
	}

	public get size(): ITaskSize {
		return this.task?.taskSize;
	}

	public get priority(): ITaskPriority {
		return this.task?.taskPriority;
	}

	public get status(): ITaskStatus {
		return this.task?.taskStatus;
	}

	public hide(): void {
		this.hidden.emit(true);
	}

	public dismiss(): void {
		this.hide();
		this._dialogRef.close();
	}
}
