import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from './language.service';
import { LanguageSelectorComponent } from './language-selector.component';
import { NgxTranslateModule } from '../ngx-translate';
import { NbSelectModule } from '@nebular/theme';
import { UserOrganizationService } from '../time-tracker/organization-selector/user-organization.service';
import { Store } from '../services';
import { LanguageSelectorService } from './language-selector.service';

@NgModule({
	declarations: [LanguageSelectorComponent],
	imports: [CommonModule, NgxTranslateModule, NbSelectModule],
	exports: [LanguageSelectorComponent],
	providers: [
		LanguageService,
		UserOrganizationService,
		Store,
		LanguageSelectorService,
	],
})
export class LanguageModule { }
