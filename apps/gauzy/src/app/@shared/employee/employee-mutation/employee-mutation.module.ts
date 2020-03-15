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
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		UserFormsModule,
		NbButtonModule,
		NbIconModule,
		NbStepperModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [EmployeeMutationComponent],
	declarations: [EmployeeMutationComponent],
	entryComponents: [EmployeeMutationComponent],
	providers: [OrganizationsService, EmployeesService, RoleService]
})
export class EmployeeMutationModule {}
