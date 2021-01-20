import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { EmployeeSelectorComponent } from './employee.component';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { TranslaterModule } from 'apps/gauzy/src/app/@shared/translater/translater.module';

const COMPONENTS = [EmployeeSelectorComponent];

@NgModule({
	imports: [CommonModule, NgSelectModule, FormsModule, TranslaterModule],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [EmployeesService, EmployeeStore]
})
export class EmployeeSelectorsModule {}
