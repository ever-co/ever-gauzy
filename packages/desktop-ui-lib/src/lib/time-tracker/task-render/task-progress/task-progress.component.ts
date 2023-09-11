import { Component } from '@angular/core';
import { TaskRenderComponent } from '../task-render.component';
import { progressStatus } from '@gauzy/common-angular';

@Component({
	selector: 'gauzy-task-progress',
	templateUrl: './task-progress.component.html',
	styleUrls: ['./task-progress.component.scss'],
})
export class TaskProgressComponent extends TaskRenderComponent {
	public get progressStatus() {
		return progressStatus;
	}

	public get progress(): number {
		if (this.task.estimate === 0) {
			return 0;
		}
		if (this.task.duration > this.task.estimate) {
			return 100
		}
		return this.task.duration / this.task.estimate * 100;
	}
}
