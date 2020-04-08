import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { CandidateSelectorComponent } from './candidate.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const COMPONENTS = [CandidateSelectorComponent];

@NgModule({
	imports: [
		CommonModule,
		NgSelectModule,
		FormsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [CandidatesService]
})
export class CandidateSelectorsModule {}
