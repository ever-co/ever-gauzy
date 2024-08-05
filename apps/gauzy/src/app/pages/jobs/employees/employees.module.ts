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
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import {
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule,
	SmartTableToggleModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { EmployeesRoutingModule } from './employees-routing.module';
import { EmployeesComponent } from './employees/employees.component';

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
		TranslateModule.forChild(),
		SharedModule,
		Angular2SmartTableModule,
		SmartTableToggleModule,
		GauzyButtonActionModule,
		PaginationV2Module,
		WorkInProgressModule
	]
})
export class EmployeesModule {}
