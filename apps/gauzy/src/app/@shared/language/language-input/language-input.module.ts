import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageInputComponent } from './language-input.component';
import { NbBadgeModule, NbSelectModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { NgSelectModule } from '@ng-select/ng-select';
import { LanguagesService } from '../../../@core/services/languages.service';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		CommonModule,
		NbSelectModule,
		NbBadgeModule,
		FormsModule,
		NgSelectModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [LanguageInputComponent],
	declarations: [LanguageInputComponent],
	providers: [LanguagesService]
})
export class LanguageInputModule {}
