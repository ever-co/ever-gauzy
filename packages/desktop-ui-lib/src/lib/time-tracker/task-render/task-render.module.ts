import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbIconModule,
	NbProgressBarModule,
	NbTooltipModule,
} from '@nebular/theme';
import { DurationFormatPipe } from '../pipes/duration-format.pipe';
import { TaskProgressComponent } from './task-progress/task-progress.component';
import { TaskDurationComponent } from './task-duration/task-duration.component';
import { TaskEstimateComponent } from './task-estimate/task-estimate.component';
import { TaskRenderCellComponent } from './task-render-cell/task-render-cell.component';
import { DesktopDirectiveModule } from '../../directives/desktop-directive.module';
import { TaskEstimateInputComponent } from './task-estimate/task-estimate-input/task-estimate-input.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TaskDueDateComponent } from './task-due-date/task-due-date.component';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [
		DurationFormatPipe,
		TaskProgressComponent,
		TaskDurationComponent,
		TaskEstimateComponent,
		TaskRenderCellComponent,
		TaskEstimateInputComponent,
		TaskDueDateComponent,
	],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbProgressBarModule,
		NbIconModule,
		NbTooltipModule,
		DesktopDirectiveModule,
		NbButtonModule,
		TranslateModule,
	],
})
export class TaskRenderModule {}
