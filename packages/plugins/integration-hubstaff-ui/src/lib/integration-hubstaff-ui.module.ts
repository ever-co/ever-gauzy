import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { getBrowserLanguage, SmartDataViewLayoutModule, SharedModule } from '@gauzy/ui-core/shared';
import { IntegrationHubstaffRoutes } from './integration-hubstaff.routes';
import { IntegrationHubstaffLayoutComponent } from './integration-hubstaff.layout.component';
import { HubstaffComponent } from './components/hubstaff/hubstaff.component';
import { HubstaffAuthorizeComponent } from './components/hubstaff-authorize/hubstaff-authorize.component';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';

@NgModule({
	declarations: [
		IntegrationHubstaffLayoutComponent,
		HubstaffAuthorizeComponent,
		HubstaffComponent,
		SettingsDialogComponent
	],
	imports: [
		NbActionsModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule,
		NgSelectModule,
		NgxPermissionsModule.forRoot(),
		TranslateModule.forRoot({
			defaultLanguage: getBrowserLanguage(), // Get the browser language and fall back to a default if needed
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		IntegrationHubstaffRoutes,
		SharedModule,
		SmartDataViewLayoutModule
	]
})
export class IntegrationHubstaffModule {}
