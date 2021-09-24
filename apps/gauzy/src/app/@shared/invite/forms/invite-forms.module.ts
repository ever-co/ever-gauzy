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
import { ThemeModule } from '../../../@theme/theme.module';
import { TranslateModule } from '../../translate/translate.module';
import { EmailInviteFormComponent } from './email-invite-form/email-invite-form.component';
import { InviteService, RoleService } from '../../../@core/services';
import { SharedModule } from '../../shared.module';
import { ContactSelectModule } from '../../contact-select/contact-select.module';

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
		TranslateModule,
		SharedModule,
		ContactSelectModule
	],
	exports: [EmailInviteFormComponent],
	declarations: [EmailInviteFormComponent],
	providers: [RoleService, InviteService]
})
export class InviteFormsModule {}
