import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule, provideAppInitializer, inject } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Store } from '../services';
import { ElectronService } from '../electron/services';
import { LanguageInitializerFactory } from './language-initializer.factory';
import { UserOrganizationService } from '../time-tracker/organization-selector/user-organization.service';
import { LanguageElectronService } from './language-electron.service';
import { LanguageSelectorComponent } from './language-selector.component';
import { LanguageSelectorService } from './language-selector.service';
import { LanguageService } from './language.service';

@NgModule({
	imports: [CommonModule, NbSelectModule, LanguageSelectorComponent, TranslateModule.forChild()],
	exports: [LanguageSelectorComponent, TranslateModule]
})
export class LanguageModule {
	static forRoot(): ModuleWithProviders<LanguageModule> {
		return {
			ngModule: LanguageModule,
			providers: [
				LanguageService,
				UserOrganizationService,
				Store,
				LanguageSelectorService,
				LanguageElectronService,
				provideAppInitializer(() => {
					const initializerFn = LanguageInitializerFactory(inject(TranslateService), inject(ElectronService));
					return initializerFn();
				})
			]
		};
	}

	static forChild(): ModuleWithProviders<LanguageModule> {
		return {
			ngModule: LanguageModule,
			providers: []
		};
	}
}
