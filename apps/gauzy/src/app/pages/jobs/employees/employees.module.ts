import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeesRoutingModule } from './employees-routing.module';
import { EmployeesComponent } from './employees/employees.component';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbButtonModule,
	NbToggleModule,
	NbTabsetModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PaginationV2Module, SmartTableToggleModule } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '../../../@shared/shared.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../../@shared/gauzy-button-action/gauzy-button-action.module';
import { WorkInProgressModule } from '../../work-in-progress/work-in-progress.module';

@NgModule({
	declarations: [EmployeesComponent],
	imports: [
		CommonModule,
		EmployeesRoutingModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbButtonModule,
		NbToggleModule,
		NbTabsetModule,
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
		SharedModule,
		FormsModule,
		Angular2SmartTableModule,
		SmartTableToggleModule,
		HeaderTitleModule,
		GauzyButtonActionModule,
		PaginationV2Module,
		WorkInProgressModule
	]
})
export class EmployeesModule {}
