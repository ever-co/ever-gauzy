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
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { OrganizationClientsService } from 'apps/gauzy/src/app/@core/services/organization-clients.service ';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { OrganizationVendorsService } from 'apps/gauzy/src/app/@core/services/organization-vendors.service';
import { EmployeeMultiSelectModule } from 'apps/gauzy/src/app/@shared/employee/employee-multi-select/employee-multi-select.module';
import { EntityWithMembersModule } from 'apps/gauzy/src/app/@shared/entity-with-members-card/entity-with-members-card.module';
import { ImageUploaderModule } from 'apps/gauzy/src/app/@shared/image-uploader/image-uploader.module';
import { OrganizationsMutationModule } from 'apps/gauzy/src/app/@shared/organizations/organizations-mutation/organizations-mutation.module';
import { RemoveLodashModule } from 'apps/gauzy/src/app/@shared/remove-lodash/remove-lodash.module';
import { UserFormsModule } from 'apps/gauzy/src/app/@shared/user/forms/user-forms.module';
import { EmployeeSelectorsModule } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ColorPickerModule } from 'ngx-color-picker';
import {
	HttpLoaderFactory,
	ThemeModule
} from '../../../../@theme/theme.module';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { EditOrganizationClientMutationComponent } from './edit-organization-clients/edit-organization-clients-mutation/edit-organization-clients-mutation.component';
import { EditOrganizationClientsComponent } from './edit-organization-clients/edit-organization-clients.component';
import { InviteClientComponent } from './edit-organization-clients/invite-client/invite-client.component';
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
import { TagsColorInputModule } from 'apps/gauzy/src/app/@shared/tags/tags-color-input/tags-color-input.module';
import { EditOrganizationExpenseCategoriesComponent } from './edit-organization-expense-categories/edit-organization-expense-categories.component';
import { OrganizationExpenseCategoriesService } from 'apps/gauzy/src/app/@core/services/organization-expense-categories.service';
import { InviteService } from '../../../../@core/services/invite.service';

@NgModule({
	imports: [
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
		TagsColorInputModule
	],
	providers: [
		OrganizationDepartmentsService,
		OrganizationVendorsService,
		OrganizationExpenseCategoriesService,
		OrganizationPositionsService,
		OrganizationClientsService,
		OrganizationEditStore,
		EmployeeStore,
		InviteService
	],
	entryComponents: [InviteClientComponent],
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
		EditOrganizationClientsComponent,
		EditOrganizationProjectsComponent,
		EditOrganizationTeamsComponent,
		EditOrganizationTeamsMutationComponent,
		EditOrganizationOtherSettingsComponent,
		EditOrganizationDepartmentsMutationComponent,
		EditOrganizationClientMutationComponent,
		EditOrganizationProjectsMutationComponent,
		EditOrganizationEmploymentTypes,
		InviteClientComponent
	]
})
export class EditOrganizationSettingsModule {}
