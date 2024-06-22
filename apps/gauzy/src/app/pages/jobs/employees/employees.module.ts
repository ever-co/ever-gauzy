import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbButtonModule,
	NbToggleModule,
	NbTabsetModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { NgxPermissionsModule } from 'ngx-permissions';
import { i4netButtonActionModule, PaginationV2Module, SmartTableToggleModule } from '@gauzy/ui-core/shared';
import { EmployeesRoutingModule } from './employees-routing.module';
import { EmployeesComponent } from './employees/employees.component';
import { SharedModule } from '@gauzy/ui-core/shared';
import { WorkInProgressModule } from '../../work-in-progress/work-in-progress.module';

@NgModule({
	declarations: [EmployeesComponent],
	imports: [
		CommonModule,
		FormsModule,
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
		Angular2SmartTableModule,
		SmartTableToggleModule,
		i4netButtonActionModule,
		PaginationV2Module,
		WorkInProgressModule
	]
})
export class EmployeesModule { }
