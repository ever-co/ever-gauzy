import { HttpBackend, HttpClient } from '@angular/common/http';
import {
	TranslateLoader,
	TranslateModuleConfig,
	TranslateService,
} from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguagesEnum } from '@gauzy/contracts';

export function translateBrowserLoaderFactory(handler: HttpBackend) {
	return new TranslateHttpLoader(new HttpClient(handler));
}

export function configureTranslate(translateService: TranslateService) {
	return () => {
		const config: TranslateModuleConfig = {
			defaultLanguage: LanguagesEnum.ENGLISH,
			loader: {
				provide: TranslateLoader,
				useFactory: translateBrowserLoaderFactory,
				deps: [HttpBackend],
			},
		};

		translateService.setDefaultLang(config.defaultLanguage);
		translateService.use(config.defaultLanguage);
	};
}
