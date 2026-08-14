import { NgModule } from '@angular/core';
import {
	NbAccordionModule,
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
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import {
	CandidatesService,
	InviteGuard,
	OrganizationEmploymentTypesService,
	OrganizationsService,
	SkillsService
} from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	EditEmployeeMembershipFormModule,
	EmployeeEndWorkModule,
	EmployeeLocationModule,
	EmployeeMutationModule,
	EmployeeRatesModule,
	EmployeeStartWorkModule,
	FavoriteToggleModule,
	ImageUploaderModule,
	InviteMutationModule,
	InviteTableModule,
	LanguageSelectorModule,
	RecurringExpenseBlockModule,
	RecurringExpenseDeleteConfirmationModule,
	RecurringExpenseMutationModule,
	RecordViewModule,
	RichTextEditorModule,
	SharedModule,
	SkillsInputModule,
	TableComponentsModule,
	TagsColorInputModule,
	TimeZoneSelectorModule,
	DynamicTabsModule
} from '@gauzy/ui-core/shared';
import {
	EditEmployeeContactComponent,
	EditEmployeeDocumentsComponent,
	EditEmployeeEmploymentComponent,
	EditEmployeeHiringComponent,
	EditEmployeeLocationComponent,
	EditEmployeeMainComponent,
	EditEmployeeProjectsComponent,
	EditEmployeeRatesComponent,
	EditEmployeeProfileComponent,
	EditEmployeeOtherSettingsComponent
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
	EmployeeWorkStatusComponent,
	EmployeeTimeTrackingStatusComponent
} from './table-components';
import { EditEmployeeNetworksComponent } from './edit-employee/edit-employee-profile/edit-employee-networks/edit-employee-networks.component';
import { ViewEmployeeComponent } from './view-employee/view-employee.component';
import { DocumentLinksPanelComponent } from '@gauzy/plugin-docs-ui';

const COMPONENTS = [
	EmployeesComponent,
	ViewEmployeeComponent,
	EmployeeBonusComponent,
	EmployeeAverageIncomeComponent,
	EmployeeAverageExpensesComponent,
	EmployeeAverageBonusComponent,
	EmployeeWorkStatusComponent,
	EmployeeTimeTrackingStatusComponent,
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
	EditEmployeeNetworksComponent,
	EditEmployeeOtherSettingsComponent,
	EditEmployeeDocumentsComponent
];

@NgModule({
	imports: [
		RichTextEditorModule,
		NbAccordionModule,
		NbActionsModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		NbTooltipModule,
		NgSelectModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		EmployeesRoutingModule,
		SharedModule,
		RecordViewModule,
		TableComponentsModule,
		EmployeeMutationModule,
		EmployeeEndWorkModule,
		RecurringExpenseMutationModule,
		ImageUploaderModule,
		InviteMutationModule,
		InviteTableModule,
		RecurringExpenseDeleteConfirmationModule,
		EditEmployeeMembershipFormModule,
		RecurringExpenseBlockModule,
		TagsColorInputModule,
		SkillsInputModule,
		EmployeeLocationModule,
		EmployeeRatesModule,
		EmployeeStartWorkModule,
		FavoriteToggleModule,
		LanguageSelectorModule,
		SmartDataViewLayoutModule,
		CardGridModule,
		TimeZoneSelectorModule,
		DynamicTabsModule,
		// Record-side Documents panel (spec 00 §6.14 R-LNK-02). Standalone, so it is
		// imported directly — the Documents hub module is never pulled in here.
		DocumentLinksPanelComponent
	],
	declarations: [...COMPONENTS],
	providers: [OrganizationsService, InviteGuard, CandidatesService, OrganizationEmploymentTypesService, SkillsService]
})
export class EmployeesModule {}
