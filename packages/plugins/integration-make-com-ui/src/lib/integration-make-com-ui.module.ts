import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { IntegrationMakeComRoutes } from './integration-make-com.routes';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';
import { AuthorizationComponent } from './components/make-com-authorize/make-com-authorize.component';
import { MakeComponent } from './components/make/make.component';
import { MakeComCallbackComponent } from './components/make-com-callback/make-com-callback.component';
import { MakeComSettingsComponent } from './components/make-com-settings/make-com-settings.component';
import { MakeComScenariosComponent } from './components/make-com-scenarios/make-com-scenarios.component';
import { MakeComHooksComponent } from './components/make-com-hooks/make-com-hooks.component';
import { MakeComConnectionsComponent } from './components/make-com-connections/make-com-connections.component';
import { MakeComTemplatesComponent } from './components/make-com-templates/make-com-templates.component';

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
		IntegrationMakeComRoutes,
		SmartDataViewLayoutModule,
		SelectorsModule,
		SharedModule,
		TableComponentsModule,
		CommonModule
	],
	declarations: [
		IntegrationMakeComLayoutComponent,
		MakeComponent,
		AuthorizationComponent,
		MakeComCallbackComponent,
		MakeComSettingsComponent,
		MakeComScenariosComponent,
		MakeComHooksComponent,
		MakeComConnectionsComponent,
		MakeComTemplatesComponent
	]
})
export class IntegrationMakeComUiModule {}
