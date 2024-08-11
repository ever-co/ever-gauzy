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
import { SharedModule, WorkInProgressModule } from '@gauzy/ui-core/shared';
import { GauzyAIRoutingModule } from './gauzy-ai-routing.module';
import { GauzyAILayoutComponent } from './gauzy-ai.layout.component';
import { GauzyAIAuthorizationComponent } from './components/authorization/authorization.component';
import { GauzyAIViewComponent } from './components/view/view.component';
import { IntegrationSettingCardComponent } from './components/integration-setting-card/integration-setting-card.component';

@NgModule({
	declarations: [
		GauzyAILayoutComponent,
		GauzyAIAuthorizationComponent,
		GauzyAIViewComponent,
		IntegrationSettingCardComponent
	],
	imports: [
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbTabsetModule,
		NbToggleModule,
		NbToggleModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		GauzyAIRoutingModule,
		WorkInProgressModule,
		SharedModule
	]
})
export class GauzyAIModule {}
