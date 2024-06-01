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
import { InviteService } from '../../@core/services/invite.service';
import { RoleService } from '../../@core/services/role.service';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { PasswordFormFieldModule } from '../../@shared/user/forms/fields/password';
import { ThemeModule } from '../../@theme/theme.module';
import { AcceptInviteFormComponent } from './accept-invite-form/accept-invite-form.component';
import { AcceptInvitePage } from './accept-invite.component';

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
		TranslateModule.forChild(),
		PasswordFormFieldModule
	],
	declarations: [AcceptInvitePage, AcceptInviteFormComponent],
	providers: [InviteService, RoleService]
})
export class AcceptInviteModule {}
