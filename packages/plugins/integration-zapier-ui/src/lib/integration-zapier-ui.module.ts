import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
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
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule, SelectorsModule, SharedModule, TableComponentsModule } from '@gauzy/ui-core/shared';
import { IntegrationZapierRoutes } from './integration-zapier.routes';
import { ZapierAuthorizeComponent } from './components/zapier-authorize/zapier-authorize.component';
import { IntegrationZapierLayoutComponent } from './integration-zapier.layout.component';
import { ZapierComponent } from './components/zapier/zapier.component';
import { ZapierCallbackComponent } from './components/zapier-callback/zapier-callback.component';
import { ZapierSettingsComponent } from './components/zapier-settings/zapier-settings.component';
import { ZapierTriggersComponent } from './components/zapier-triggers/zapier-triggers.component';
import { ZapierActionsComponent } from './components/zapier-actions/zapier-actions.component';
import { ZapierWebhooksComponent } from './components/zapier-webhooks/zapier-webhooks.component';
import { ZapierZapsComponent } from './components/zapier-zaps/zapier-zaps.component';
import { ZapierZapTemplatesComponent } from './components/zapier-zap-templates/zapier-zap-templates.component';

const NB_MODULES = [
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
	NbTooltipModule
];

@NgModule({
	imports: [
		...NB_MODULES,
		TranslateModule.forChild(),
		IntegrationZapierRoutes,
		SmartDataViewLayoutModule,
		SelectorsModule,
		SharedModule,
		TableComponentsModule,
		CommonModule,
		ReactiveFormsModule
	],
	declarations: [
		IntegrationZapierLayoutComponent,
		ZapierComponent,
		ZapierAuthorizeComponent,
		ZapierCallbackComponent,
		ZapierSettingsComponent,
		ZapierTriggersComponent,
		ZapierActionsComponent,
		ZapierWebhooksComponent,
		ZapierZapsComponent,
		ZapierZapTemplatesComponent
	]
})
export class IntegrationZapierUiModule {}
