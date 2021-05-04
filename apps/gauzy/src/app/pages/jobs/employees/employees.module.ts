import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EmployeesRoutingModule } from './employees-routing.module';
import { EmployeesComponent } from './employees/employees.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbPopoverModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbButtonModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { MomentModule } from 'ngx-moment';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { SharedModule } from '../../../@shared/shared.module';
import { StatusBadgeModule } from '../../../@shared/status-badge/status-badge.module';
import { SmartTableToggleModule } from '../../../@shared/smart-table/smart-table-toggle/smart-table-toggle.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [EmployeesComponent],
	imports: [
		CommonModule,
		EmployeesRoutingModule,

		TranslateModule,
		SharedModule,
		NbIconModule,
		NbSpinnerModule,
		MomentModule,
		NbPopoverModule,
		NbCardModule,
		NbInputModule,
		FormsModule,
		NbSelectModule,
		NbButtonModule,
		EmployeeMultiSelectModule,
		Ng2SmartTableModule,
		StatusBadgeModule,
		NbToggleModule,
		SmartTableToggleModule,
		HeaderTitleModule
	]
})
export class EmployeesModule {}
