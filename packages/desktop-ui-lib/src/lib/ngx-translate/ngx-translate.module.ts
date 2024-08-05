import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { ElectronService } from '../electron/services';
import { HttpLoaderFactory } from '../ngx-translate';
import { LanguageInitializerFactory } from './language-initializer.factory';

@NgModule({
	declarations: [],
	imports: [
		CommonModule,
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	providers: [
		TranslateService,
		{
			provide: APP_INITIALIZER,
			useFactory: LanguageInitializerFactory,
			deps: [TranslateService, ElectronService],
			multi: true
		}
	],
	exports: [TranslateModule]
})
export class NgxTranslateModule {}
