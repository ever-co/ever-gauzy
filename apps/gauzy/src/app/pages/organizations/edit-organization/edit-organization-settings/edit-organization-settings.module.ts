import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbBadgeModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { EmployeeStore } from '../../../../@core/services/employee-store.service';
import { OrganizationContactService } from '../../../../@core/services/organization-contact.service';
import { OrganizationDepartmentsService } from '../../../../@core/services/organization-departments.service';
import { OrganizationEditStore } from '../../../../@core/services/organization-edit-store.service';
import { OrganizationPositionsService } from '../../../../@core/services/organization-positions';
import { OrganizationVendorsService } from '../../../../@core/services/organization-vendors.service';
import { EmployeeMultiSelectModule } from '../../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { EntityWithMembersModule } from '../../../../@shared/entity-with-members-card/entity-with-members-card.module';
import { ImageUploaderModule } from '../../../../@shared/image-uploader/image-uploader.module';
import { OrganizationsMutationModule } from '../../../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { RemoveLodashModule } from '../../../../@shared/remove-lodash/remove-lodash.module';
import { UserFormsModule } from '../../../../@shared/user/forms/user-forms.module';
import { EmployeeSelectorsModule } from '../../../../@theme/components/header/selectors/employee/employee.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ColorPickerModule } from 'ngx-color-picker';
import {
	HttpLoaderFactory,
	ThemeModule
} from '../../../../@theme/theme.module';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { EditOrganizationContactMutationComponent } from './edit-organization-contacts/edit-organization-contact-mutation/edit-organization-contact-mutation.component';
import { EditOrganizationContactComponent } from './edit-organization-contacts/edit-organization-contact.component';
import { InviteContactComponent } from './edit-organization-contacts/invite-contact/invite-contact.component';
import { EditOrganizationDepartmentsMutationComponent } from './edit-organization-departments/edit-organization-departments-mutation/edit-organization-departments-mutation.component';
import { EditOrganizationDepartmentsComponent } from './edit-organization-departments/edit-organization-departments.component';
import { EditOrganizationLocationComponent } from './edit-organization-location/edit-organization-location.component';
import { EditOrganizationMainComponent } from './edit-organization-main/edit-organization-main.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationPositionsComponent } from './edit-organization-positions/edit-organization-positions.component';
import { EditOrganizationProjectsMutationComponent } from './edit-organization-projects/edit-organization-projects-mutation/edit-organization-projects-mutation.component';
import { EditOrganizationProjectsComponent } from './edit-organization-projects/edit-organization-projects.component';
import { EditOrganizationSettingsComponent } from './edit-organization-settings.component';
import { EditOrganizationTeamsMutationComponent } from './edit-organization-teams/edit-organization-teams-mutation/edit-organization-teams-mutation.component';
import { EditOrganizationTeamsComponent } from './edit-organization-teams/edit-organization-teams.component';
import { EditOrganizationVendorsComponent } from './edit-organization-vendors/edit-organization-vendors.component';
import { EditOrganizationEmploymentTypes } from './edit-organization-employment-types/edit-organization-employment-types.component';
import { TagsColorInputModule } from '../../../../@shared/tags/tags-color-input/tags-color-input.module';
import { EditOrganizationExpenseCategoriesComponent } from './edit-organization-expense-categories/edit-organization-expense-categories.component';
import { OrganizationExpenseCategoriesService } from '../../../../@core/services/organization-expense-categories.service';
import { InviteService } from '../../../../@core/services/invite.service';
import { TableComponentsModule } from '../../../../@shared/table-components/table-components.module';
import { EditOrganizationEmployeeLevelComponent } from './edit-organization-employee-levels/edit-organization-employee-level.component';
import { EditOrganizationDocuments } from './edit-organization-documents/edit-organization-documents/edit-organization-documents';
import { UploadDocumentComponent } from './edit-organization-documents/upload-document/upload-document.component';
import { FileUploaderModule } from 'apps/gauzy/src/app/@shared/file-uploader-input/file-uploader-input.module';
import { TasksSprintSettingsViewComponent } from '../../../tasks/components/task/task-settings/project-view/tasks-sprint-settings-view/tasks-sprint-settings-view.component';
import { SharedModule } from '../../../../@shared/shared.module';

@NgModule({
	imports: [
		NbBadgeModule,
		TableComponentsModule,
		TagsColorInputModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		NbActionsModule,
		NgSelectModule,
		ColorPickerModule,
		NbTooltipModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		Ng2SmartTableModule,
		OrganizationsMutationModule,
		UserFormsModule,
		ImageUploaderModule,
		NbSelectModule,
		RemoveLodashModule,
		NbListModule,
		NbTabsetModule,
		NbRouteTabsetModule,
		NbDatepickerModule,
		NbToggleModule,
		EmployeeSelectorsModule,
		EntityWithMembersModule,
		EmployeeMultiSelectModule,
		TagsColorInputModule,
		FileUploaderModule,
		SharedModule
	],
	providers: [
		OrganizationDepartmentsService,
		OrganizationVendorsService,
		OrganizationExpenseCategoriesService,
		OrganizationPositionsService,
		OrganizationContactService,
		OrganizationEditStore,
		EmployeeStore,
		InviteService
	],
	entryComponents: [InviteContactComponent],
	declarations: [
		EditOrganizationSettingsComponent,
		EditOrganizationMainComponent,
		EditOrganizationLocationComponent,
		OrganizationListComponent,
		EditOrganizationDepartmentsComponent,
		EditOrganizationVendorsComponent,
		EditOrganizationExpenseCategoriesComponent,
		EditOrganizationPositionsComponent,
		EditOrganizationPositionsComponent,
		EditOrganizationContactComponent,
		EditOrganizationProjectsComponent,
		EditOrganizationTeamsComponent,
		EditOrganizationTeamsMutationComponent,
		EditOrganizationOtherSettingsComponent,
		EditOrganizationDepartmentsMutationComponent,
		EditOrganizationContactMutationComponent,
		EditOrganizationProjectsMutationComponent,
		EditOrganizationEmploymentTypes,
		EditOrganizationDocuments,
		InviteContactComponent,
		UploadDocumentComponent,
		EditOrganizationEmployeeLevelComponent
	]
})
export class EditOrganizationSettingsModule {}
