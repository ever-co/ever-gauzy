import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDatepickerModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { SharedModule } from '../shared.module';
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
		NbInputModule,
		SharedModule
	]
})
export class TasksSprintSettingsViewModule {}
