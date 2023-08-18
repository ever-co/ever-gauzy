import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
	NbCardModule,
	NbSelectModule,
	NbInputModule,
	NbSpinnerModule,
	NbButtonModule
} from '@nebular/theme';
import { IntegrationsRoutingModule } from './integrations-routing.module';
import { IntegrationsComponent } from './integrations.component';
import { SharedModule } from '../../@shared/shared.module';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	declarations: [IntegrationsComponent],
	imports: [
		CommonModule,
		IntegrationsRoutingModule,
		NbCardModule,
		SharedModule,
		NbSelectModule,
		NbInputModule,
		NbSpinnerModule,
		NbButtonModule,
		TranslateModule
	]
})
export class IntegrationsModule { }
