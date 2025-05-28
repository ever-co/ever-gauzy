import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	OrganizationContactService,
	OrganizationDepartmentsService,
	OrganizationProjectsService,
	OrganizationsService
} from '@gauzy/ui-core/core';
import { InviteMutationComponent } from './invite-mutation.component';
import { InviteFormsModule } from '../forms/invite-forms.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCardModule,
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
		OrganizationDepartmentsService
	]
})
export class InviteMutationModule {}
