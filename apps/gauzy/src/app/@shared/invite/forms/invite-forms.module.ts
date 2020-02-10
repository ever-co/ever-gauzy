import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { InviteService } from '../../../@core/services/invite.service';
import { RoleService } from '../../../@core/services/role.service';
import { ThemeModule } from '../../../@theme/theme.module';
import { EmailInviteFormComponent } from './email-invite-form/email-invite-form.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbInputModule,
		NbCardModule,
		NbButtonModule,
		NgSelectModule,
		NbSelectModule,
		NbAlertModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [EmailInviteFormComponent],
	declarations: [EmailInviteFormComponent],
	entryComponents: [EmailInviteFormComponent],
	providers: [RoleService, InviteService]
})
export class InviteFormsModule {}
