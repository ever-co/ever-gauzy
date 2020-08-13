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

import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { SkillsInputModule } from '../../skills/skills-input/skills-input.module';
import { LanguageInputModule } from '../../language/language-input/language-input.module';
import { CKEditorModule } from 'ng2-ckeditor';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbBadgeModule,
		NbToggleModule,
		NbTabsetModule,
		CKEditorModule,
		TagsColorInputModule
	],
	declarations: [PublicPageEmployeeMutationComponent],
	entryComponents: [PublicPageEmployeeMutationComponent],
	providers: []
})
export class PublicPageEmployeeMutationModule {}
