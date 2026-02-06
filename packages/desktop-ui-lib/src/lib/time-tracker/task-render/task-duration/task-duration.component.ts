import { Component } from '@angular/core';
import { DurationFormatPipe } from '../../pipes/duration-format.pipe';
import { TaskRenderComponent } from '../task-render.component';

@Component({
	selector: 'gauzy-task-duration',
	templateUrl: './task-duration.component.html',
	styleUrls: ['./task-duration.component.scss'],
	imports: [DurationFormatPipe]
})
export class TaskDurationComponent extends TaskRenderComponent {
	public get total(): number {
		return this.task?.duration;
	}

	public get today(): number {
		return this.task?.todayDuration;
	}
}
