import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { InviteService, RoleService } from '@gauzy/ui-core/core';
import { SharedModule } from '../../shared.module';
import { ContactSelectModule } from '../../contact-select/contact-select.module';
import { RoleFormFieldModule } from '../../user/forms/fields/role/role.module';
import { EmailInviteFormComponent } from './email-invite-form/email-invite-form.component';

@NgModule({
	imports: [
		CommonModule,
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
		I18nTranslateModule.forChild(),
		SharedModule,
		ContactSelectModule,
		RoleFormFieldModule
	],
	exports: [EmailInviteFormComponent],
	declarations: [EmailInviteFormComponent],
	providers: [RoleService, InviteService]
})
export class InviteFormsModule {}
