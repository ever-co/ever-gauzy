import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbDatepickerModule,
	NbTagModule,
	NbIconModule,
	NbFormFieldModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { EmailInviteFormComponent } from './email-invite-form/email-invite-form.component';
import { InviteService, RoleService } from '../../../@core/services';
import { SharedModule } from '../../shared.module';
import { ContactSelectModule } from '../../contact-select/contact-select.module';
import { RoleFormFieldModule } from '../../user/forms/fields/role';

@NgModule({
	imports: [
		FormsModule,
		ReactiveFormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbTagModule,
		NbTooltipModule,
		NgSelectModule,
		ThemeModule,
		TranslateModule.forChild(),
		SharedModule,
		ContactSelectModule,
		RoleFormFieldModule
	],
	exports: [EmailInviteFormComponent],
	declarations: [EmailInviteFormComponent],
	providers: [RoleService, InviteService]
})
export class InviteFormsModule {}
