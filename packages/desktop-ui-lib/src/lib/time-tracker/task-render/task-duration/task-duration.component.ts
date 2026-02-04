import { Component } from '@angular/core';
import { TaskRenderComponent } from '../task-render.component';
import { DurationFormatPipe } from '../../pipes/duration-format.pipe';
import { PipesModule } from '../../../../../../ui-core/shared/src/lib/pipes/pipes.module';

@Component({
    selector: 'gauzy-task-duration',
    templateUrl: './task-duration.component.html',
    styleUrls: ['./task-duration.component.scss'],
    imports: [DurationFormatPipe, PipesModule]
})
export class TaskDurationComponent extends TaskRenderComponent {
	public get total(): number {
		return this.task?.duration;
	}

	public get today(): number {
		return this.task?.todayDuration;
	}
}
