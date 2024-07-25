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
import { InviteService, OrganizationsService, RoleService } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationsMutationModule, PasswordFormFieldModule } from '@gauzy/ui-core/shared';
import { AcceptClientInviteFormComponent } from './accept-client-invite-form/accept-client-invite-form.component';
import { AcceptClientInvitePage } from './accept-client-invite.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbSidebarModule,
		NbLayoutModule,
		NgSelectModule,
		NbSelectModule,
		NbInputModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		NbCheckboxModule,
		TranslateModule.forChild(),
		OrganizationsMutationModule,
		PasswordFormFieldModule
	],
	declarations: [AcceptClientInvitePage, AcceptClientInviteFormComponent],
	providers: [InviteService, RoleService, OrganizationsService]
})
export class OnboardOrganizationClientModule {}
