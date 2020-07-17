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
	NbTabsetModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../@shared/shared.module';
import { EditKpiComponent } from './edit-kpi/edit-kpi.component';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { ThemeModule } from '../../@theme/theme.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [
		GoalSettingsComponent,
		EditTimeFrameComponent,
		EditKpiComponent
	],
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		ReactiveFormsModule,
		Ng2SmartTableModule,
		NbButtonModule,
		NbSelectModule,
		NbDatepickerModule,
		NbInputModule,
		NbDatepickerModule,
		GoalSettingsRoutingModule,
		NbListModule,
		EmployeeMultiSelectModule,
		SharedModule,
		NbTabsetModule,
		ThemeModule,
		CardGridModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	]
})
export class GoalSettingsModule {}
