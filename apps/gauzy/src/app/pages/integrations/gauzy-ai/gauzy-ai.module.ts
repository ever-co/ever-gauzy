import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbInputModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from './../../../@shared/translate/translate.module';
import { BackNavigationModule } from './../../../@shared/back-navigation';
import { GauzyAIRoutingModule } from './gauzy-ai-routing.module';
import { GauzyAIAuthorizeComponent } from './gauzy-ai-authorize/gauzy-ai-authorize.component';

@NgModule({
	declarations: [
		GauzyAIAuthorizeComponent
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
		BackNavigationModule,
		TranslateModule
	]
})
export class GauzyAIModule { }
