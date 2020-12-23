import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbIconModule,
	NbDialogModule,
	NbListModule,
	NbTabsetModule,
	NbTooltipModule,
	NbBadgeModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { RolePermissionsService } from '../../@core/services/role-permissions.service';
import { RoleService } from '../../@core/services/role.service';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { EditRolesPermissionsComponent } from './edit-roles-permissions/edit-roles-permissions.component';
import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './settings.component';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { DangerZoneComponent } from './danger-zone/danger-zone.component';
import { EmailHistoryComponent } from './email-history/email-history.component';
import { EmailFiltersComponent } from './email-history/email-filters/email-filters.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { FileStorageComponent } from './file-storage/file-storage.component';
import { CustomSmtpComponent } from './custom-smtp/custom-smtp.component';
import { SMTPModule } from '../../@shared/smtp/smtp.module';
import { SmsGatewayComponent } from './sms-gateway/sms-gateway.component';
import { FeatureComponent } from './feature/feature.component';
import { FeatureToggleModule } from '../../@shared/feature-toggle/feature-toggle.module';

@NgModule({
	imports: [
		SettingsRoutingModule,
		EmailTemplatesModule,
		ThemeModule,
		NbCardModule,
		UserFormsModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbToggleModule,
		NbSpinnerModule,
		NbIconModule,
		NbDialogModule,
		NbListModule,
		NbTabsetModule,
		ReactiveFormsModule,
		NbTooltipModule,
		NbBadgeModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NgSelectModule,
		BackNavigationModule,
		SMTPModule,
		FeatureToggleModule
	],
	entryComponents: [EditRolesPermissionsComponent, DangerZoneComponent],
	declarations: [
		FileStorageComponent,
		SettingsComponent,
		EditRolesPermissionsComponent,
		DangerZoneComponent,
		EmailHistoryComponent,
		EmailFiltersComponent,
		CustomSmtpComponent,
		SmsGatewayComponent,
		FeatureComponent
	],
	providers: [RolePermissionsService, RoleService]
})
export class SettingsModule {}
