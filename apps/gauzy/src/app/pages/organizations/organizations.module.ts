import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';

import { RecurringExpenseDeleteConfirmationModule } from '../../@shared/expenses/recurring-expense-delete-confirmation/recurring-expense-delete-confirmation.module';
import { RecurringExpenseMutationModule } from '../../@shared/expenses/recurring-expense-mutation/recurring-expense-mutation.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { OrganizationsMutationModule } from '../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { RemoveLodashModule } from '../../@shared/remove-lodash/remove-lodash.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { EditOrganizationSettingsModule } from './edit-organization/edit-organization-settings/edit-organization-settings.module';
import { EditOrganizationComponent } from './edit-organization/edit-organization.component';
import { OrganizationsRoutingModule } from './organizations-routing.module';
import { OrganizationsComponent } from './organizations.component';
import { OrganizationsCurrencyComponent } from './table-components/organizations-currency/organizations-currency.component';
import { OrganizationsEmployeesComponent } from './table-components/organizations-employees/organizations-employees.component';
import { OrganizationsFullnameComponent } from './table-components/organizations-fullname/organizations-fullname.component';
import { OrganizationsStatusComponent } from './table-components/organizations-status/organizations-status.component';

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
		RecurringExpenseMutationModule,
		RecurringExpenseDeleteConfirmationModule,
		NbTooltipModule,
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
