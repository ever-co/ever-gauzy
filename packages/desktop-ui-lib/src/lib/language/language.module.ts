import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule, APP_INITIALIZER } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { I18nModule } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../services';
import { ElectronService } from '../electron/services';
import { LanguageInitializerFactory } from './language-initializer.factory';
import { UserOrganizationService } from '../time-tracker/organization-selector/user-organization.service';
import { LanguageElectronService } from './language-electron.service';
import { LanguageSelectorComponent } from './language-selector.component';
import { LanguageSelectorService } from './language-selector.service';
import { LanguageService } from './language.service';

@NgModule({
	imports: [CommonModule, NbSelectModule, LanguageSelectorComponent, I18nModule.forChild()],
	exports: [LanguageSelectorComponent, I18nModule]
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
				{
					provide: APP_INITIALIZER,
					useFactory: (translateService: TranslateService, electronService: ElectronService) => {
						return LanguageInitializerFactory(translateService, electronService);
					},
					deps: [TranslateService, ElectronService],
					multi: true
				}
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
