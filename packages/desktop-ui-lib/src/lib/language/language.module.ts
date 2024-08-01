import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { NgxTranslateModule } from '../ngx-translate';
import { Store } from '../services';
import { UserOrganizationService } from '../time-tracker/organization-selector/user-organization.service';
import { LanguageElectronService } from './language-electron.service';
import { LanguageSelectorComponent } from './language-selector.component';
import { LanguageSelectorService } from './language-selector.service';
import { LanguageService } from './language.service';

@NgModule({
	declarations: [LanguageSelectorComponent],
	imports: [CommonModule, NgxTranslateModule, NbSelectModule],
	exports: [LanguageSelectorComponent, NgxTranslateModule]
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
				LanguageElectronService
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
