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
import { TranslateModule } from '@ngx-translate/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '../../../@shared/shared.module';
import { SmartTableToggleModule } from '../../../@shared/smart-table/smart-table-toggle/smart-table-toggle.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../../@shared/gauzy-button-action/gauzy-button-action.module';
import { PaginationModule } from '../../../@shared/pagination/pagination.module';

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
		TranslateModule,
		SharedModule,
		FormsModule,
		Ng2SmartTableModule,
		SmartTableToggleModule,
		HeaderTitleModule,
		GauzyButtonActionModule,
		PaginationModule
	]
})
export class EmployeesModule {}
