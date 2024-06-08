import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	OrganizationContactService,
	OrganizationDepartmentsService,
	OrganizationProjectsService,
	OrganizationsService,
	UsersService
} from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { InviteMutationComponent } from './invite-mutation.component';
import { InviteFormsModule } from '../forms/invite-forms.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		I18nTranslateModule.forChild(),
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
