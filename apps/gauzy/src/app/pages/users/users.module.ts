import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
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
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UsersRoutingModule } from './users-routing.module';
import { UsersComponent } from './users.component';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { UserMutationModule } from '../../@shared/user/user-mutation/user-mutation.module';
import { UserFullNameComponent } from './table-components/user-fullname/user-fullname.component';
import { EditUserProfileComponent } from './edit-user-profile/edit-user-profile.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { EditProfileFormModule } from '../../@shared/user/edit-profile-form/edit-profile-form.module';
import { InviteMutationModule } from '../../@shared/invite/invite-mutation/invite-mutation.module';
import { ManageUserInviteComponent } from './manage-user-invite/manage-user-invite.component';
import { InviteTableModule } from '../../@shared/invite/invites/invites.module';
import { InviteGuard } from '../../@core/role/invite.guard';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const COMPONENTS = [
	UsersComponent,
	UserFullNameComponent,
	EditUserProfileComponent,
	ManageUserInviteComponent
];

@NgModule({
	imports: [
		UsersRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		UserMutationModule,
		NbTooltipModule,
		NgSelectModule,
		NbSelectModule,
		ImageUploaderModule,
		NbBadgeModule,
		NbRouteTabsetModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule,
		EditProfileFormModule,
		InviteMutationModule,
		InviteTableModule
	],
	declarations: [...COMPONENTS],
	entryComponents: [UserFullNameComponent],
	providers: [OrganizationsService, UsersOrganizationsService, InviteGuard]
})
export class UsersModule {}
