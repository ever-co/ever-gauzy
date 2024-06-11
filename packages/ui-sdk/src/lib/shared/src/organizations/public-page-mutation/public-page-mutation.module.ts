import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbTabsetModule,
	NbTagModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { LanguagesService, SkillsService } from '@gauzy/ui-sdk/core';
import { PublicPageMutationComponent } from './public-page-mutation.component';
import { SkillsInputModule } from '../../skills/skills-input/skills-input.module';
import { LanguageSelectorModule } from '../../language/language-selector/language-selector.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbActionsModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbSelectModule,
		NbTabsetModule,
		NbTagModule,
		NbToggleModule,
		NbTooltipModule,
		NgSelectModule,
		I18nTranslateModule.forChild(),
		CKEditorModule,
		SkillsInputModule,
		LanguageSelectorModule
	],
	declarations: [PublicPageMutationComponent],
	providers: [SkillsService, LanguagesService]
})
export class PublicPageMutationModule {}
