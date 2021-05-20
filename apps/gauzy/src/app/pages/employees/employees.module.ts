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
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { EditEmployeeMembershipFormModule } from '../../@shared/employee/edit-employee-membership-form/edit-employee-membership-form.module';
import { EmployeeEndWorkModule } from '../../@shared/employee/employee-end-work-popup/employee-end-work.module';
import { EmployeeMutationModule } from '../../@shared/employee/employee-mutation/employee-mutation.module';
import { RecurringExpenseDeleteConfirmationModule } from '../../@shared/expenses/recurring-expense-delete-confirmation/recurring-expense-delete-confirmation.module';
import { RecurringExpenseMutationModule } from '../../@shared/expenses/recurring-expense-mutation/recurring-expense-mutation.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { InviteMutationModule } from '../../@shared/invite/invite-mutation/invite-mutation.module';
import { InviteTableModule } from '../../@shared/invite/invites/invites.module';
import { ThemeModule } from '../../@theme';
import { InviteGuard } from './../../@core/guards';
import { 
	EditEmployeeContactComponent,
	EditEmployeeEmploymentComponent,
	EditEmployeeHiringComponent,
	EditEmployeeLocationComponent,
	EditEmployeeMainComponent,
	EditEmployeeProjectsComponent,
	EditEmployeeRatesComponent,
	EditEmployeeProfileComponent
} from './edit-employee/edit-employee-profile';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import { EmployeesRoutingModule } from './employees-routing.module';
import { EmployeesComponent } from './employees.component';
import { ManageEmployeeInviteComponent } from './manage-employee-invite/manage-employee-invite.component';
import { 
	EmployeeAverageBonusComponent,
	EmployeeAverageExpensesComponent,
	EmployeeAverageIncomeComponent,
	EmployeeBonusComponent,
	EmployeeWorkStatusComponent
} from './table-components';
import { SharedModule } from '../../@shared/shared.module';
import { RecurringExpenseBlockModule } from '../../@shared/expenses/recurring-expense-block/recurring-expense-block.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { SkillsInputModule } from '../../@shared/skills/skills-input/skills-input.module';
import { EmployeeLocationModule } from '../../@shared/employee/employee-location/employee-location.module';
import { EmployeeRatesModule } from '../../@shared/employee/employee-rates/employee-rates.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { CKEditorModule } from 'ng2-ckeditor';
import { EditEmployeeNetworksComponent } from './edit-employee/edit-employee-profile/edit-employee-networks/edit-employee-networks.component';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { LanguageSelectorModule } from '../../@shared/language/language-selector/language-selector.module';
import { CandidatesService, OrganizationEmploymentTypesService, OrganizationsService, SkillsService } from '../../@core/services';

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
	EditEmployeeContactComponent,
	EditEmployeeHiringComponent,
	EditEmployeeLocationComponent,
	EditEmployeeEmploymentComponent,
	EditEmployeeNetworksComponent
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
		TranslateModule,
		NbSpinnerModule,
		InviteMutationModule,
		InviteTableModule,
		RecurringExpenseDeleteConfirmationModule,
		NbActionsModule,
		EditEmployeeMembershipFormModule,
		NbDatepickerModule,
		RecurringExpenseBlockModule,
		TagsColorInputModule,
		SkillsInputModule,
		EmployeeLocationModule,
		EmployeeRatesModule,
		CKEditorModule,
		HeaderTitleModule,
		LanguageSelectorModule,
	],
	declarations: [...COMPONENTS],
	providers: [
		OrganizationsService,
		InviteGuard,
		CandidatesService,
		OrganizationEmploymentTypesService,
		SkillsService
	]
})
export class EmployeesModule {}
