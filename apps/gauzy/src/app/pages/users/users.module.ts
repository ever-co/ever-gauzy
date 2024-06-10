import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbTooltipModule,
	NbBadgeModule,
	NbSelectModule,
	NbRouteTabsetModule,
	NbSpinnerModule,
	NbSidebarModule,
	NbLayoutModule,
	NbActionsModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgSelectModule } from '@ng-select/ng-select';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { InviteGuard, OrganizationsService, UsersOrganizationsService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../@theme/theme.module';
import { UsersRoutingModule } from './users-routing.module';
import { UsersComponent } from './users.component';
import { UserMutationModule } from '../../@shared/user/user-mutation/user-mutation.module';
import { EditUserProfileComponent } from './edit-user-profile/edit-user-profile.component';
import { EditUserMutationComponent } from './edit-user-mutation/edit-user-mutation.component';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { EditProfileFormModule } from '../../@shared/user/edit-profile-form/edit-profile-form.module';
import { InviteMutationModule } from '../../@shared/invite/invite-mutation/invite-mutation.module';
import { ManageUserInviteComponent } from './manage-user-invite/manage-user-invite.component';
import { InviteTableModule } from '../../@shared/invite/invites/invites.module';
import { UserMultiSelectModule } from '../../@shared/user/user-multi-select/user-multi-select.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { EditUserOrganizationsComponent } from './edit-user-profile/edit-user-organizations/edit-user-organizations.component';
import { EditEmployeeMembershipFormModule } from '../../@shared/employee/edit-employee-membership-form/edit-employee-membership-form.module';
import { EditUserDataComponent } from './edit-user-profile/edit-user-data/edit-user-data.component';
import { UserOrganizationsMultiSelectModule } from '../../@shared/user/user-organizations-multi-select/user-organizations-multi-select.module';
import { EditUserOrganizationsMutationComponent } from './edit-user-profile/edit-user-organizations/edit-user-organizations-mutation/edit-user-organizations-mutation.component';
import { UserIdService } from '@gauzy/ui-sdk/core';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { SharedModule } from '../../@shared/shared.module';

const COMPONENTS = [
	UsersComponent,
	EditUserProfileComponent,
	ManageUserInviteComponent,
	EditUserMutationComponent,
	EditUserOrganizationsComponent,
	EditUserDataComponent,
	EditUserOrganizationsMutationComponent
];

@NgModule({
	imports: [
		TagsColorInputModule,
		TableComponentsModule,
		NbSidebarModule,
		NbLayoutModule,
		UsersRoutingModule,
		UserMultiSelectModule,
		UserOrganizationsMultiSelectModule,
		OrganizationsModule,
		NbActionsModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Angular2SmartTableModule,
		NbDialogModule.forChild(),
		UserMutationModule,
		NbTooltipModule,
		NgSelectModule,
		NbSelectModule,
		ImageUploaderModule,
		NbBadgeModule,
		NbRouteTabsetModule,
		I18nTranslateModule.forChild(),
		NbSpinnerModule,
		EditProfileFormModule,
		InviteMutationModule,
		InviteTableModule,
		EditEmployeeMembershipFormModule,
		NgxPermissionsModule.forChild(),
		GauzyButtonActionModule,
		PaginationV2Module,
		CardGridModule,
		SharedModule
	],
	declarations: [...COMPONENTS],
	providers: [OrganizationsService, UsersOrganizationsService, InviteGuard, UserIdService]
})
export class UsersModule {}
