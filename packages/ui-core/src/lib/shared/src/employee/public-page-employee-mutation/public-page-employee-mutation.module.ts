import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { SharedModule } from '../../shared.module';
import { PublicPageEmployeeMutationComponent } from './public-page-employee-mutation.component';
import { SkillsInputModule } from '../../skills/skills-input/skills-input.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { LanguageSelectorModule } from '../../language/language-selector';
import { CurrencyModule } from '../../modules/currency';

@NgModule({
	imports: [
		CommonModule,
		SkillsInputModule,
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
		I18nTranslateModule.forChild(),
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
