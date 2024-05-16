import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbStepperModule,
	NbTagModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeeMutationComponent } from './employee-mutation.component';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { EmployeesService, OrganizationsService, RoleService } from '../../../@core/services';
import { ThemeModule } from '../../../@theme/theme.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbStepperModule,
		NbTagModule,
		NbSpinnerModule,
		UserFormsModule,
		TranslateModule
	],
	exports: [EmployeeMutationComponent],
	declarations: [EmployeeMutationComponent],
	providers: [OrganizationsService, EmployeesService, RoleService]
})
export class EmployeeMutationModule {}
