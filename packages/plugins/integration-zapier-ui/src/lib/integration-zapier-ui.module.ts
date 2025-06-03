import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ZapierAuthorizeComponent } from './components/zapier-authorize/zapier-authorize.component';
import { integrationZapierRoutes } from './integration-zapier.routes';
import { IntegrationZapierLayoutComponent } from './integration-zapier.layout.component';
import { ZapierSettingsComponent } from './components/zapier-settings/zapier-settings.component';
import { ZapierWebhookComponent } from './components/zapier-webhook/zapier-webhook.component';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,
		RouterModule.forChild(integrationZapierRoutes),
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		TranslateModule,
		SharedModule
	],
	declarations: [
		IntegrationZapierLayoutComponent,
		ZapierAuthorizeComponent,
		ZapierSettingsComponent,
		ZapierWebhookComponent
	]
})
export class IntegrationZapierUiModule {}
