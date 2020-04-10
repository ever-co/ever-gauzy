import { CandidatesService } from './../../@core/services/candidates.service';
import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { CountryService } from '../../@core/services/country.service';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { EditEmployeeMembershipFormModule } from '../../@shared/employee/edit-employee-membership-form/edit-employee-membership-form.module';
import { EmployeeEndWorkModule } from '../../@shared/employee/employee-end-work-popup/employee-end-work.module';
import { EmployeeMutationModule } from '../../@shared/employee/employee-mutation/employee-mutation.module';
import { RecurringExpenseDeleteConfirmationModule } from '../../@shared/expenses/recurring-expense-delete-confirmation/recurring-expense-delete-confirmation.module';
import { RecurringExpenseMutationModule } from '../../@shared/expenses/recurring-expense-mutation/recurring-expense-mutation.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { InviteMutationModule } from '../../@shared/invite/invite-mutation/invite-mutation.module';
import { InviteTableModule } from '../../@shared/invite/invites/invites.module';
import { ThemeModule } from '../../@theme/theme.module';
import { InviteGuard } from './../../@core/role/invite.guard';
import { EditEmployeeClientComponent } from './edit-employee/edit-employee-profile/edit-employee-client/edit-employee-client.component';
import { EditEmployeeEmploymentComponent } from './edit-employee/edit-employee-profile/edit-employee-employment/edit-employee-employment.component';
import { EditEmployeeHiringComponent } from './edit-employee/edit-employee-profile/edit-employee-hiring/edit-employee-hiring.component';
import { EditEmployeeLocationComponent } from './edit-employee/edit-employee-profile/edit-employee-location/edit-employee-location.component';
import { EditEmployeeMainComponent } from './edit-employee/edit-employee-profile/edit-employee-main/edit-employee-main.component';
import { EditEmployeeProfileComponent } from './edit-employee/edit-employee-profile/edit-employee-profile.component';
import { EditEmployeeProjectsComponent } from './edit-employee/edit-employee-profile/edit-employee-projects/edit-employee-projects.component';
import { EditEmployeeRatesComponent } from './edit-employee/edit-employee-profile/edit-employee-rate/edit-employee-rate.component';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import { EmployeesRoutingModule } from './employees-routing.module';
import { EmployeesComponent } from './employees.component';
import { ManageEmployeeInviteComponent } from './manage-employee-invite/manage-employee-invite.component';
import { EmployeeAverageBonusComponent } from './table-components/employee-average-bonus/employee-average-bonus.component';
import { EmployeeAverageExpensesComponent } from './table-components/employee-average-expenses/employee-average-expenses.component';
import { EmployeeAverageIncomeComponent } from './table-components/employee-average-income/employee-average-income.component';
import { EmployeeBonusComponent } from './table-components/employee-bonus/employee-bonus.component';
import { EmployeeWorkStatusComponent } from './table-components/employee-work-status/employee-work-status.component';
import { SharedModule } from '../../@shared/shared.module';
import { RecurringExpenseBlockModule } from '../../@shared/expenses/recurring-expense-block/recurring-expense-block.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { EmployeeLocationModule } from '../../@shared/employee/employee-location/employee-location.module';
import { EmployeeRatesModule } from '../../@shared/employee/employee-rates/employee-rates.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const COMPONENTS = [
	EmployeesComponent,
	EmployeeBonusComponent,
	EmployeeAverageIncomeComponent,
	EmployeeAverageExpensesComponent,
	EmployeeAverageBonusComponent,
	EmployeeWorkStatusComponent,
	EditEmployeeComponent,
	EditEmployeeProfileComponent,
	EditEmployeeMainComponent,
	EditEmployeeRatesComponent,
	ManageEmployeeInviteComponent,
	EditEmployeeProjectsComponent,
	EditEmployeeClientComponent,
	EditEmployeeHiringComponent,
	EditEmployeeLocationComponent,
	EditEmployeeEmploymentComponent
];

@NgModule({
	imports: [
		TableComponentsModule,
		SharedModule,
		EmployeesRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		EmployeeMutationModule,
		EmployeeEndWorkModule,
		NbTooltipModule,
		NgSelectModule,
		NbSelectModule,
		RecurringExpenseMutationModule,
		ImageUploaderModule,
		NbBadgeModule,
		NbRouteTabsetModule,
		NbCheckboxModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule,
		InviteMutationModule,
		InviteTableModule,
		RecurringExpenseDeleteConfirmationModule,
		NbActionsModule,
		EditEmployeeMembershipFormModule,
		NbDatepickerModule,
		RecurringExpenseBlockModule,
		TagsColorInputModule,
		EmployeeLocationModule,
		EmployeeRatesModule
	],
	declarations: [...COMPONENTS],
	entryComponents: [
		EmployeeBonusComponent,
		EmployeeAverageIncomeComponent,
		EmployeeAverageExpensesComponent,
		EmployeeAverageBonusComponent,
		EmployeeWorkStatusComponent,
		ManageEmployeeInviteComponent
	],
	providers: [
		OrganizationsService,
		InviteGuard,
		CountryService,
		CandidatesService,
		OrganizationEmploymentTypesService
	]
})
export class EmployeesModule {}
