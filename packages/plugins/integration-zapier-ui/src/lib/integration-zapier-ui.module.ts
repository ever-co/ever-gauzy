import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbDatepickerModule,
	NbCheckboxModule,
	NbActionsModule,
	NbRouteTabsetModule,
	NbCalendarKitModule,
	NbSpinnerModule,
	NbContextMenuModule,
	NbTabsetModule,
	NbTooltipModule,
	NbToggleModule
} from '@nebular/theme';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import {
	getBrowserLanguage,
	SelectorsModule,
	SharedModule,
	SmartDataViewLayoutModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { ZapierAuthorizeComponent } from './components/zapier-authorize/zapier-authorize.component';
import { IntegrationZapierLayoutComponent } from './integration-zapier.layout.component';
import { ZapierSettingsComponent } from './components/zapier-settings/zapier-settings.component';
import { ZapierWebhookComponent } from './components/zapier-webhook/zapier-webhook.component';
import { IntegrationZapierRoutes } from './integration-zapier.routes';
import { ZapierComponent } from './components/zapier/zapier.component';

@NgModule({
	imports: [
		NbActionsModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCalendarKitModule,
		NbCardModule,
		NbCheckboxModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbTabsetModule,
		NbToggleModule,
		NbTooltipModule,
		TranslateModule.forChild({
			defaultLanguage: getBrowserLanguage(),
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		IntegrationZapierRoutes,
		SmartDataViewLayoutModule,
		SelectorsModule,
		SharedModule,
		TableComponentsModule,
		CommonModule
	],
	declarations: [
		ZapierComponent,
		IntegrationZapierLayoutComponent,
		ZapierAuthorizeComponent,
		ZapierSettingsComponent,
		ZapierWebhookComponent
	]
})
export class IntegrationZapierUiModule {}
