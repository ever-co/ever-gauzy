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
import { ThemeModule } from '../../@theme/theme.module';
import { AcceptClientInviteFormComponent } from './accept-client-invite-form/accept-client-invite-form.component';
import { AcceptClientInvitePage } from './accept-client-invite.component';
import { OrganizationsMutationComponent } from '../../@shared/organizations/organizations-mutation/organizations-mutation.component';
import { OrganizationsMutationModule } from '../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { TranslaterModule } from '../../@shared/translater/translater.module';

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
		TranslaterModule,
		OrganizationsMutationModule
	],
	declarations: [AcceptClientInvitePage, AcceptClientInviteFormComponent],
	entryComponents: [
		AcceptClientInvitePage,
		AcceptClientInviteFormComponent,
		OrganizationsMutationComponent
	],
	providers: [InviteService, RoleService, OrganizationsService]
})
export class OnboardOrganizationClientModule {}
