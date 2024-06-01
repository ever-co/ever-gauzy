import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule as NgxTranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from './translate-http-loader';
import { I18nService } from './i18n.service';

@NgModule({
	imports: [
		NgxTranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	providers: [I18nService],
	exports: [NgxTranslateModule]
})
export class TranslateModule {}
