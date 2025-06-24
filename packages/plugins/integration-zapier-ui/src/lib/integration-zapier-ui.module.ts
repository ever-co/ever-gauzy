import { NgModule } from '@angular/core';
// Angular core modules
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
	NbActionsModule,
	NbButtonModule,
	NbCalendarKitModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	SmartDataViewLayoutModule,
	SelectorsModule,
	SharedModule,
	TableComponentsModule,
	getBrowserLanguage
} from '@gauzy/ui-core/shared';
import { IntegrationZapierRoutes } from './integration-zapier.routes';
import { ZapierAuthorizeComponent } from './components/zapier-authorize/zapier-authorize.component';
import { IntegrationZapierLayoutComponent } from './integration-zapier.layout.component';
import { ZapierComponent } from './components/zapier/zapier.component';
import { ZapierCallbackComponent } from './components/zapier-callback/zapier-callback.component';
import { ZapierSettingsComponent } from './components/zapier-settings/zapier-settings.component';
import { ZapierTriggersComponent } from './components/zapier-triggers/zapier-triggers.component';
import { ZapierActionsComponent } from './components/zapier-actions/zapier-actions.component';
import { ZapierWebhooksComponent } from './components/zapier-webhooks/zapier-webhooks.component';

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
		IntegrationZapierLayoutComponent,
		ZapierComponent,
		ZapierAuthorizeComponent,
		ZapierCallbackComponent,
		ZapierSettingsComponent,
		ZapierTriggersComponent,
		ZapierActionsComponent,
		ZapierWebhooksComponent
	]
})
export class IntegrationZapierUiModule {}
