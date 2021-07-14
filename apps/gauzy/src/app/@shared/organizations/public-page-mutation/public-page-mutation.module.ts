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
import { PublicPageMutationComponent } from './public-page-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { SkillsInputModule } from '../../skills/skills-input/skills-input.module';
import { LanguageSelectorModule } from '../../language/language-selector/language-selector.module';
import { SkillsService } from '../../../@core/services/skills.service';
import { LanguagesService } from '../../../@core/services/languages.service';
import { CKEditorModule } from 'ng2-ckeditor';
import { TranslateModule } from '../../translate/translate.module';

@NgModule({
	imports: [
		SkillsInputModule,
		LanguageSelectorModule,
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
		TranslateModule,
		NbBadgeModule,
		NbToggleModule,
		NbTabsetModule,
		CKEditorModule
	],
	declarations: [PublicPageMutationComponent],
	providers: [SkillsService, LanguagesService]
})
export class PublicPageMutationModule {}
