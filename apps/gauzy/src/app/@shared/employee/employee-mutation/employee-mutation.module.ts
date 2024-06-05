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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeesService, OrganizationsService, RoleService } from '@gauzy/ui-sdk/core';
import { EmployeeMutationComponent } from './employee-mutation.component';
import { UserFormsModule } from '../../user/forms/user-forms.module';
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
		I18nTranslateModule.forChild()
	],
	exports: [EmployeeMutationComponent],
	declarations: [EmployeeMutationComponent],
	providers: [OrganizationsService, EmployeesService, RoleService]
})
export class EmployeeMutationModule {}
