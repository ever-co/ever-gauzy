import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbIconModule,
	NbDialogModule,
	NbListModule,
	NbTabsetModule,
	NbTooltipModule,
	NbBadgeModule,
	NbToggleModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgSelectModule } from '@ng-select/ng-select';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './settings.component';
import { DangerZoneComponent } from './danger-zone/danger-zone.component';
import { EmailHistoryComponent } from './email-history/email-history.component';
import { EmailFiltersComponent } from './email-history/email-filters/email-filters.component';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { SmsGatewayComponent } from './sms-gateway/sms-gateway.component';
import { AccountingTemplatesModule } from '../accounting-templates/accounting-templates.module';

@NgModule({
	imports: [
		CommonModule,
		SettingsRoutingModule,
		EmailTemplatesModule,
		AccountingTemplatesModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbIconModule,
		NbDialogModule,
		NbListModule,
		NbTabsetModule,
		ReactiveFormsModule,
		NbTooltipModule,
		NbBadgeModule,
		NbToggleModule,
		I18nTranslateModule.forChild(),
		NgSelectModule,
		NgxPermissionsModule.forChild(),
		SharedModule
	],
	declarations: [
		SettingsComponent,
		DangerZoneComponent,
		EmailHistoryComponent,
		EmailFiltersComponent,
		SmsGatewayComponent
	],
	providers: []
})
export class SettingsModule {}
