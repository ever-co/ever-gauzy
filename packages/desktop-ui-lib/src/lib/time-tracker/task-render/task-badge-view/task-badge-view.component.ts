import { AsyncPipe, TitleCasePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SafeUrl } from '@angular/platform-browser';
import { ITaskPriority, ITaskSize, ITaskStatus } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { StatusIconService } from '../../../services/status-icon-service';
import { ColorAdapter } from '../../../utils';
import { ReplacePipe } from '../../pipes/replace.pipe';

export type ITaskBadge = ITaskStatus | ITaskSize | ITaskPriority;

@Component({
	selector: 'gauzy-task-badge-view',
	templateUrl: './task-badge-view.component.html',
	styleUrls: ['./task-badge-view.component.scss'],
	imports: [AsyncPipe, TitleCasePipe, ReplacePipe]
})
export class TaskBadgeViewComponent {
	constructor(private _statusIconService: StatusIconService) {
		this._taskBadge = null;
	}

	private _taskBadge: ITaskBadge;

	public get taskBadge(): ITaskBadge {
		return this._taskBadge;
	}

	@Input()
	public set taskBadge(value: ITaskBadge) {
		this._taskBadge = value;
	}

	public get textColor() {
		return ColorAdapter.contrast(this.taskBadge.color);
	}

	public get backgroundColor() {
		return ColorAdapter.background(this.taskBadge.color);
	}

	public get icon$(): Observable<SafeUrl> {
		if (!this.taskBadge?.fullIconUrl) return null;
		return this._statusIconService.load(this.taskBadge?.fullIconUrl);
	}

	public get name() {
		return this.taskBadge.name;
	}

	public get imageFilter() {
		return ColorAdapter.hexToHsl(this.taskBadge.color);
	}
}
