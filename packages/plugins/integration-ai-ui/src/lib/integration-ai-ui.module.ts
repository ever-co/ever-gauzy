import { NgModule } from '@angular/core';

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
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@gauzy/ui-core/i18n';
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
			defaultLanguage: getBrowserLanguage(),
			loader: provideTranslateHttpLoader()
		}),
		IntegrationAiRoutes,
		WorkInProgressModule,
		SharedModule
	]
})
export class IntegrationAiUiModule {}
