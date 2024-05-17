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
	NbTabsetModule,
	NbTagModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { CKEditorModule } from 'ckeditor4-angular';
import { PublicPageEmployeeMutationComponent } from './public-page-employee-mutation.component';
import { SkillsInputModule } from '../../skills/skills-input/skills-input.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { CurrencyModule } from '../../currency/currency.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { LanguageSelectorModule } from '../../language/language-selector';
import { ThemeModule } from '../../../@theme/theme.module';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		SkillsInputModule,
		ThemeModule,
		SharedModule,
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
		TranslateModule,
		NbBadgeModule,
		NbToggleModule,
		NbTabsetModule,
		CKEditorModule,
		TagsColorInputModule,
		CurrencyModule,
		LanguageSelectorModule,
		NbTagModule
	],
	declarations: [PublicPageEmployeeMutationComponent],
	providers: []
})
export class PublicPageEmployeeMutationModule {}
