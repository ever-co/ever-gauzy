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
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	CardGridModule,
	EmployeeMultiSelectModule,
	i4netButtonActionModule,
	GoalCustomUnitModule,
	GoalTemplatesModule,
	PaginationV2Module,
	SharedModule
} from '@gauzy/ui-core/shared';
import { EditKpiComponent } from './edit-kpi/edit-kpi.component';

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
		CardGridModule,
		NbCheckboxModule,
		NbToggleModule,
		GoalCustomUnitModule,
		GoalTemplatesModule,
		NbFormFieldModule,
		NbSpinnerModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild(),
		i4netButtonActionModule,
		PaginationV2Module
	]
})
export class GoalSettingsModule { }
