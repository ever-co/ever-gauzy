import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { FeatureRoutingModule } from './feature-routing.module';
import { FeatureComponent } from './feature.component';
import { FeatureToggleModule } from '../../../@shared/feature-toggle/feature-toggle.module';

@NgModule({
	imports: [
		FeatureRoutingModule,
		ThemeModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		FeatureToggleModule
	],
	declarations: [FeatureComponent],
	providers: []
})
export class FeatureModule {}
