import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbProgressBarModule } from '@nebular/theme';
import { DurationFormatPipe } from '../pipes/duration-format.pipe';
import { TaskProgressComponent } from './task-progress/task-progress.component';
import { TaskDurationComponent } from './task-duration/task-duration.component';
import { TaskEstimateComponent } from './task-estimate/task-estimate.component';

@NgModule({
	declarations: [
		DurationFormatPipe,
		TaskProgressComponent,
		TaskDurationComponent,
		TaskEstimateComponent,
	],
	imports: [CommonModule, NbProgressBarModule],
})
export class TaskRenderModule { }
