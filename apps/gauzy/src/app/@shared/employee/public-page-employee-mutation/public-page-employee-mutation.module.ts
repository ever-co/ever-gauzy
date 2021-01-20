import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbListModule,
	NbActionsModule,
	NbButtonModule,
	NbIconModule,
	NbDatepickerModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule,
	NbTooltipModule,
	NbBadgeModule,
	NbToggleModule,
	NbTabsetModule
} from '@nebular/theme';
import { PublicPageEmployeeMutationComponent } from './public-page-employee-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { SkillsInputModule } from '../../skills/skills-input/skills-input.module';
import { LanguageInputModule } from '../../language/language-input/language-input.module';
import { CKEditorModule } from 'ng2-ckeditor';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { CurrencyModule } from '../../currency/currency.module';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		SkillsInputModule,
		LanguageInputModule,
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbListModule,
		NbActionsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		NbDatepickerModule,
		NbInputModule,
		NbSelectModule,
		NbCheckboxModule,
		NbTooltipModule,
		SkillsInputModule,
		TranslaterModule,
		NbBadgeModule,
		NbToggleModule,
		NbTabsetModule,
		CKEditorModule,
		TagsColorInputModule,
		CurrencyModule
	],
	declarations: [PublicPageEmployeeMutationComponent],
	entryComponents: [PublicPageEmployeeMutationComponent],
	providers: []
})
export class PublicPageEmployeeMutationModule {}
