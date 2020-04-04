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
import { AcceptClientInviteFormComponent } from './accept-client-invite-form/accept-client-invite-form.component';
import { AcceptClientInvitePage } from './accept-client-invite.component';
import { OrganizationsMutationComponent } from '../../@shared/organizations/organizations-mutation/organizations-mutation.component';
import { OrganizationsMutationModule } from '../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { OrganizationsService } from '../../@core/services/organizations.service';

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
		}),
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
