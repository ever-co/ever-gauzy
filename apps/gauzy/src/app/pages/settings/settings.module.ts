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
import { RolePermissionsService } from '../../@core/services/role-permissions.service';
import { RoleService } from '../../@core/services/role.service';
import { ThemeModule } from '../../@theme/theme.module';
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
import { SmsGatewayComponent } from './sms-gateway/sms-gateway.component';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { AccountingTemplatesModule } from '../accounting-templates/accounting-templates.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '../../@shared/shared.module';

@NgModule({
	imports: [
		SettingsRoutingModule,
		EmailTemplatesModule,
		AccountingTemplatesModule,
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
		TranslateModule,
		NgSelectModule,
		BackNavigationModule,
		HeaderTitleModule,
		NgxPermissionsModule.forChild(),
		SharedModule,
	],
	declarations: [
		FileStorageComponent,
		SettingsComponent,
		EditRolesPermissionsComponent,
		DangerZoneComponent,
		EmailHistoryComponent,
		EmailFiltersComponent,
		SmsGatewayComponent,
	],
	providers: [RolePermissionsService, RoleService]
})
export class SettingsModule {}
