import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { WorkInProgressModule } from '../../work-in-progress/work-in-progress.module';
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
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbTabsetModule,
		NbToggleModule,
		NbToggleModule,
		NbTooltipModule,
		GauzyAIRoutingModule,
		I18nTranslateModule.forChild(),
		WorkInProgressModule,
		SharedModule
	]
})
export class GauzyAIModule {}
