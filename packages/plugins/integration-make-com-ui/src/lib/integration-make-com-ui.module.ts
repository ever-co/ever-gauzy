import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ReactiveFormsModule } from '@angular/forms';
import { NgxBackNavigationModule } from '@gauzy/ui-sdk/shared';
import { IntegrationMakeComRoutes } from './integration-make-com.routes';
import { WebhooksComponent } from './components/webhooks/webhooks.component';
import { ScenariosComponent } from './components/scenarios/scenarios.component';
import { AuthorizationComponent } from './components/authorization/authorization.component';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';

@NgModule({
	imports: [
		CommonModule,
		IntegrationMakeComRoutes,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		TranslateModule,
		NgxPermissionsModule.forChild(),
		ReactiveFormsModule,
		NgxBackNavigationModule
	],
	declarations: [
		IntegrationMakeComLayoutComponent,
		WebhooksComponent,
		ScenariosComponent,
		AuthorizationComponent
	]
})
export class IntegrationMakeComUiModule {}
