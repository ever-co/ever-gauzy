import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureToggleComponent } from './feature-toggle.component';
import { FeatureService } from '../../@core/services/feature/feature.service';
import { FeatureStoreService } from '../../@core/services/feature/feature-store.service';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		NbToggleModule,
		ThemeModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [FeatureToggleComponent],
	exports: [FeatureToggleComponent],
	providers: [FeatureService, FeatureStoreService]
})
export class FeatureToggleModule {}
