import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { EmployeeSelectorComponent } from './employee.component';
import { EmployeesService, EmployeeStore } from './../../../../../@core/services';
import { TranslateModule } from './../../../../../@shared/translate/translate.module';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';

const COMPONENTS = [EmployeeSelectorComponent];

@NgModule({
	imports: [CommonModule, NgSelectModule, FormsModule, TranslateModule, SharedModule],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [EmployeesService, EmployeeStore]
})
export class EmployeeSelectorsModule {}
