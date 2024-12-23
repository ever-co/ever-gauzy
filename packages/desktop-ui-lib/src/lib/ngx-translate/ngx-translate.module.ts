import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NgModule, inject, provideAppInitializer } from '@angular/core';
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
		provideAppInitializer(() => {
        const initializerFn = (LanguageInitializerFactory)(inject(TranslateService), inject(ElectronService));
        return initializerFn();
      })
	],
	exports: [TranslateModule]
})
export class NgxTranslateModule {}
