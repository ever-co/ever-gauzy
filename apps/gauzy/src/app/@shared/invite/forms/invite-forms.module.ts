import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbDatepickerModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { InviteService } from '../../../@core/services/invite.service';
import { RoleService } from '../../../@core/services/role.service';
import { ThemeModule } from '../../../@theme/theme.module';
import { TranslateModule } from '../../translate/translate.module';
import { EmailInviteFormComponent } from './email-invite-form/email-invite-form.component';

@NgModule({
	imports: [
		ThemeModule,
		NbDatepickerModule,
		FormsModule,
		ReactiveFormsModule,
		NbInputModule,
		NbCardModule,
		NbButtonModule,
		NgSelectModule,
		NbSelectModule,
		NbAlertModule,
		TranslateModule
	],
	exports: [EmailInviteFormComponent],
	declarations: [EmailInviteFormComponent],
	providers: [RoleService, InviteService]
})
export class InviteFormsModule {}
