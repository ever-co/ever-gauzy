import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbInputModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from './../../../@shared/translate/translate.module';
import { BackNavigationModule } from './../../../@shared/back-navigation';
import { GauzyAIRoutingModule } from './gauzy-ai-routing.module';
import { GauzyAILayoutComponent } from './gauzy-ai.layout.component';
import { GauzyAIAuthorizationComponent } from './components/authorization/authorization.component';
import { GauzyAIViewComponent } from './components/view/view.component';
import { WorkInProgressModule } from '../../work-in-progress/work-in-progress.module';

@NgModule({
	declarations: [
		GauzyAILayoutComponent,
		GauzyAIAuthorizationComponent,
		GauzyAIViewComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbTooltipModule,
		GauzyAIRoutingModule,
		TranslateModule,
		BackNavigationModule,
		WorkInProgressModule
	]
})
export class GauzyAIModule { }
