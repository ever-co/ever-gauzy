import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../../@theme/theme.module';
import { CandidateMultiSelectComponent } from './candidate-multi-select.component';
import { SharedModule } from '../../shared.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		NbSelectModule,
		SharedModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [CandidateMultiSelectComponent],
	entryComponents: [CandidateMultiSelectComponent],
	exports: [CandidateMultiSelectComponent],
	providers: []
})
export class CandidateMultiSelectModule {}
