import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { InviteService } from '../../@core/services/invite.service';
import { RoleService } from '../../@core/services/role.service';
import { ThemeModule } from '../../@theme/theme.module';
import { AcceptInviteFormComponent } from './accept-invite-form/accept-invite-form.component';
import { AcceptInvitePage } from './accept-invite.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		// RouterModule.forChild(routes),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [AcceptInvitePage, AcceptInviteFormComponent],
	entryComponents: [AcceptInvitePage, AcceptInviteFormComponent],
	providers: [InviteService, RoleService]
})
export class AcceptInviteModule {}
