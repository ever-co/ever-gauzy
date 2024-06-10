import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalSettingsRoutingModule } from './goal-settings-routing.module';
import { GoalSettingsComponent } from './goal-settings.component';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbSelectModule,
	NbDatepickerModule,
	NbInputModule,
	NbDialogModule,
	NbListModule,
	NbTabsetModule,
	NbCheckboxModule,
	NbToggleModule,
	NbFormFieldModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../@shared/shared.module';
import { EditKpiComponent } from './edit-kpi/edit-kpi.component';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { ThemeModule } from '../../@theme/theme.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { GoalCustomUnitModule } from '../../@shared/goal/goal-custom-unit/goal-custom-unit.module';
import { GoalTemplatesModule } from '../../@shared/goal/goal-templates/goal-templates.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';

@NgModule({
	declarations: [GoalSettingsComponent, EditTimeFrameComponent, EditKpiComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		ReactiveFormsModule,
		Angular2SmartTableModule,
		NbButtonModule,
		NbSelectModule,
		NbDatepickerModule,
		NbInputModule,
		NbDatepickerModule,
		NbTooltipModule,
		GoalSettingsRoutingModule,
		NbListModule,
		EmployeeMultiSelectModule,
		SharedModule,
		NbTabsetModule,
		ThemeModule,
		CardGridModule,
		NbCheckboxModule,
		NbToggleModule,
		GoalCustomUnitModule,
		GoalTemplatesModule,
		NbFormFieldModule,
		NbSpinnerModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild(),
		GauzyButtonActionModule,
		PaginationV2Module
	]
})
export class GoalSettingsModule {}
