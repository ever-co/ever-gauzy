import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbPopoverModule,
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
import { TaskBadgeViewComponent } from './task-badge-view/task-badge-view.component';
import { TaskStatusComponent } from './task-status/task-status.component';
import { TaskBadgeDefaultComponent } from './task-badge-default/task-badge-default.component';
import { ReplacePipe } from '../pipes/replace.pipe';
import { TaskDetailComponent } from './task-detail/task-detail.component';

@NgModule({
	declarations: [
		DurationFormatPipe,
		TaskProgressComponent,
		TaskDurationComponent,
		TaskEstimateComponent,
		TaskRenderCellComponent,
		TaskEstimateInputComponent,
		TaskDueDateComponent,
		TaskBadgeViewComponent,
		ReplacePipe,
		TaskStatusComponent,
		TaskBadgeDefaultComponent,
		TaskDetailComponent,
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
		NbPopoverModule,
		NbBadgeModule,
		NbCardModule,
	],
	exports: [ReplacePipe],
})
export class TaskRenderModule {}
