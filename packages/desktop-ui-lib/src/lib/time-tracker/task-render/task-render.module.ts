import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbPopoverModule,
	NbProgressBarModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DesktopDirectiveModule } from '../../directives/desktop-directive.module';
import { PipeModule } from '../pipes/pipe.module';
import { TaskBadgeDefaultComponent } from './task-badge-default/task-badge-default.component';
import { TaskBadgeViewComponent } from './task-badge-view/task-badge-view.component';
import { TaskDetailComponent } from './task-detail/task-detail.component';
import { TaskDueDateComponent } from './task-due-date/task-due-date.component';
import { TaskDurationComponent } from './task-duration/task-duration.component';
import { TaskEstimateInputComponent } from './task-estimate/task-estimate-input/task-estimate-input.component';
import { TaskEstimateComponent } from './task-estimate/task-estimate.component';
import { TaskProgressComponent } from './task-progress/task-progress.component';
import { TaskRenderCellComponent } from './task-render-cell/task-render-cell.component';
import { TaskStatusComponent } from './task-status/task-status.component';

@NgModule({
	declarations: [
		TaskProgressComponent,
		TaskDurationComponent,
		TaskEstimateComponent,
		TaskRenderCellComponent,
		TaskEstimateInputComponent,
		TaskDueDateComponent,
		TaskBadgeViewComponent,
		TaskStatusComponent,
		TaskBadgeDefaultComponent,
		TaskDetailComponent
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
		PipeModule
	],
	exports: [TaskBadgeViewComponent]
})
export class TaskRenderModule {}
