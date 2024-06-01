import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbInputModule,
	NbLayoutModule,
	NbSelectModule,
	NbSidebarModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { InviteService, RoleService } from '../../@core/services';
import { ThemeModule } from '../../@theme/theme.module';
import { AcceptClientInviteFormComponent } from './accept-client-invite-form/accept-client-invite-form.component';
import { AcceptClientInvitePage } from './accept-client-invite.component';
import { OrganizationsMutationModule } from '../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import { PasswordFormFieldModule } from '../../@shared/user/forms/fields/password';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		ThemeModule,
		NbSidebarModule,
		NbLayoutModule,
		NgSelectModule,
		NbSelectModule,
		NbInputModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		NbCheckboxModule,
		I18nTranslateModule.forChild(),
		OrganizationsMutationModule,
		PasswordFormFieldModule
	],
	declarations: [AcceptClientInvitePage, AcceptClientInviteFormComponent],
	providers: [InviteService, RoleService, OrganizationsService]
})
export class OnboardOrganizationClientModule {}
