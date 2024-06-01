import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService, UsersService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { InviteMutationComponent } from './invite-mutation.component';
import { InviteFormsModule } from '../forms/invite-forms.module';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';
import { OrganizationDepartmentsService } from '../../../@core/services/organization-departments.service';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule.forChild(),
		InviteFormsModule
	],
	exports: [InviteMutationComponent],
	declarations: [InviteMutationComponent],
	providers: [
		OrganizationsService,
		OrganizationProjectsService,
		OrganizationContactService,
		OrganizationDepartmentsService,
		UsersService
	]
})
export class InviteMutationModule {}
