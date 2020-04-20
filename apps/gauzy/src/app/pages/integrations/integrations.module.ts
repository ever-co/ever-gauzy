import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IntegrationsRoutingModule } from './integrations-routing.module';
import { IntegrationsComponent } from './components/integrations/integrations.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { NbCardModule } from '@nebular/theme';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { IntegrationsListComponent } from './components/integrations-list/integrations-list.component';
import { SharedModule } from '../../@shared/shared.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [IntegrationsComponent, IntegrationsListComponent],
	imports: [
		CommonModule,
		IntegrationsRoutingModule,
		NbCardModule,
		SharedModule,
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
