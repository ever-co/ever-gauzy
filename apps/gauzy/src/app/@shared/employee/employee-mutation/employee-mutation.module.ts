import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbStepperModule
} from '@nebular/theme';
import { EmployeeMutationComponent } from './employee-mutation.component';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { RoleService } from '../../../@core/services/role.service';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		UserFormsModule,
		NbButtonModule,
		NbIconModule,
		NbStepperModule,
		TranslaterModule
	],
	exports: [EmployeeMutationComponent],
	declarations: [EmployeeMutationComponent],
	entryComponents: [EmployeeMutationComponent],
	providers: [OrganizationsService, EmployeesService, RoleService]
})
export class EmployeeMutationModule {}
