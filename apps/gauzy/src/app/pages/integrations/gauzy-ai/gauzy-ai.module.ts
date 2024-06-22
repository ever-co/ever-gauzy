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
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { SharedModule } from '@gauzy/ui-core/shared';
import { WorkInProgressModule } from '../../work-in-progress/work-in-progress.module';
import { i4netAIRoutingModule } from './gauzy-ai-routing.module';
import { i4netAILayoutComponent } from './gauzy-ai.layout.component';
import { i4netAIAuthorizationComponent } from './components/authorization/authorization.component';
import { i4netAIViewComponent } from './components/view/view.component';
import { IntegrationSettingCardComponent } from './components/integration-setting-card/integration-setting-card.component';

@NgModule({
	declarations: [
		i4netAILayoutComponent,
		i4netAIAuthorizationComponent,
		i4netAIViewComponent,
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
		i4netAIRoutingModule,
		I18nTranslateModule.forChild(),
		WorkInProgressModule,
		SharedModule
	]
})
export class i4netAIModule { }
