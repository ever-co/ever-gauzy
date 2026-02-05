import { CommonModule } from '@angular/common';
import { NgModule, inject, provideAppInitializer } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@gauzy/ui-core/i18n';
import { ElectronService } from '../electron/services';
import { LanguageInitializerFactory } from './language-initializer.factory';

@NgModule({
	declarations: [],
	imports: [
		CommonModule,
		TranslateModule.forRoot({
			loader: provideTranslateHttpLoader()
		})
	],
	providers: [
		TranslateService,
		provideAppInitializer(() => {
			const initializerFn = LanguageInitializerFactory(inject(TranslateService), inject(ElectronService));
			return initializerFn();
		})
	],
	exports: [TranslateModule]
})
export class NgxTranslateModule {}
