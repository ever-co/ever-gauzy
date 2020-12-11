import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntegrationsRoutingModule } from './integrations-routing.module';
import { IntegrationsComponent } from './components/integrations/integrations.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import {
	NbCardModule,
	NbSelectModule,
	NbInputModule,
	NbSpinnerModule,
	NbButtonModule
} from '@nebular/theme';
import { IntegrationsListComponent } from './components/integrations-list/integrations-list.component';
import { SharedModule } from '../../@shared/shared.module';
import { HttpLoaderFactory } from '../../@theme/theme.module';

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	]
})
export class IntegrationsModule {}
