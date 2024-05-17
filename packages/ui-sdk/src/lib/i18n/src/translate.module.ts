import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule as NgxTranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from './translate-http-loader';

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
	exports: [NgxTranslateModule]
})
export class TranslateModule {}
