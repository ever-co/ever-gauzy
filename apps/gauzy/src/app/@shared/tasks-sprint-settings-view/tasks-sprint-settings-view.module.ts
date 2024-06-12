import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDatepickerModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { GauzyEditableGridModule } from '../editable-grid/gauzy-editable-grid.module';
import { SprintDialogComponent } from './sprint-dialog/sprint-dialog.component';
import { TasksSprintSettingsViewComponent } from './tasks-sprint-settings-view.component';

@NgModule({
	declarations: [TasksSprintSettingsViewComponent, SprintDialogComponent],
	exports: [TasksSprintSettingsViewComponent, SprintDialogComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		FormsModule,
		ReactiveFormsModule,
		NbDatepickerModule,
		I18nTranslateModule.forChild(),
		GauzyEditableGridModule,
		I18nTranslateModule.forChild(),
		NbInputModule,
		SharedModule
	]
})
export class TasksSprintSettingsViewModule {}
