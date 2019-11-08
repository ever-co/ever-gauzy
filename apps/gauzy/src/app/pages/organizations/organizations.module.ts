import { NgModule } from '@angular/core';
import { ThemeModule, HttpLoaderFactory } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSelectModule,
	NbListModule,
	NbTabsetModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OrganizationsRoutingModule } from './organizations-routing.module';
import { OrganizationsComponent } from './organizations.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { OrganizationsFullnameComponent } from './table-components/organizations-fullname/organizations-fullname.component';
import { OrganizationsStatusComponent } from './table-components/organizations-status/organizations-status.component';
import { OrganizationsMutationModule } from '../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { RemoveLodashModule } from '../../@shared/remove-lodash/remove-lodash.module';
import { EditOrganizationComponent } from './edit-organization/edit-organization.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { EditOrganizationSettingsModule } from './edit-organization/edit-organization-settings/edit-organization-settings.module';
import { OrganizationsCurrencyComponent } from './table-components/organizations-currency/organizations-currency.component';
import { OrganizationsEmployeesComponent } from './table-components/organizations-employees/organizations-employees.component';
import { EmployeeModule } from 'apps/api/src/app/employee';

@NgModule({
	imports: [
		OrganizationsRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		Ng2SmartTableModule,
		NbIconModule,
		NbDialogModule.forChild(),
		OrganizationsMutationModule,
		UserFormsModule,
		ImageUploaderModule,
		NbSelectModule,
		RemoveLodashModule,
		NbListModule,
		NbTabsetModule,
		EditOrganizationSettingsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule
	],
	entryComponents: [
		OrganizationsFullnameComponent,
		OrganizationsStatusComponent,
		EditOrganizationComponent,
		OrganizationsEmployeesComponent,
		OrganizationsCurrencyComponent
	],
	declarations: [
		OrganizationsComponent,
		OrganizationsFullnameComponent,
		OrganizationsStatusComponent,
		EditOrganizationComponent,
		OrganizationsEmployeesComponent,
		OrganizationsCurrencyComponent
	]
})
export class OrganizationsModule {}
