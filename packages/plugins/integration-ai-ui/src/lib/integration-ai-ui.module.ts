import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { SharedModule, WorkInProgressModule, getBrowserLanguage } from '@gauzy/ui-core/shared';
import { IntegrationAiRoutes } from './integration-ai.routes';
import { IntegrationAILayoutComponent } from './integration-ai.layout.component';
import { IntegrationAIAuthorizationComponent } from './components/authorization/authorization.component';
import { IntegrationAIViewComponent } from './components/view/view.component';
import { IntegrationSettingCardComponent } from './components/integration-setting-card/integration-setting-card.component';

@NgModule({
	declarations: [
		IntegrationAILayoutComponent,
		IntegrationAIAuthorizationComponent,
		IntegrationAIViewComponent,
		IntegrationSettingCardComponent
	],
	imports: [
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbTabsetModule,
		NbToggleModule,
		NbTooltipModule,
		NgxPermissionsModule.forRoot(),
		TranslateModule.forRoot({
			defaultLanguage: getBrowserLanguage(), // Get the browser language and fall back to a default if needed
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		IntegrationAiRoutes,
		WorkInProgressModule,
		SharedModule
	],
	providers: []
})
export class IntegrationAiUiModule {}
