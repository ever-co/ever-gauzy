import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntegrationsRoutingModule } from './integrations-routing.module';
import { IntegrationsComponent } from './components/integrations/integrations.component';
import {
	NbCardModule,
	NbSelectModule,
	NbInputModule,
	NbSpinnerModule,
	NbButtonModule
} from '@nebular/theme';
import { IntegrationsListComponent } from './components/integrations-list/integrations-list.component';
import { SharedModule } from '../../@shared/shared.module';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	declarations: [IntegrationsComponent, IntegrationsListComponent],
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
export class IntegrationsModule {}
