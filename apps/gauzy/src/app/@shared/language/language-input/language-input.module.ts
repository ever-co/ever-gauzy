import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageInputComponent } from './language-input.component';
import { NbBadgeModule, NbSelectModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { LanguagesService } from '../../../@core/services/languages.service';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		CommonModule,
		NbSelectModule,
		NbBadgeModule,
		FormsModule,
		NgSelectModule,
		TranslaterModule
	],
	exports: [LanguageInputComponent],
	declarations: [LanguageInputComponent],
	providers: [LanguagesService]
})
export class LanguageInputModule {}
