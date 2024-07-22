import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbToggleModule
} from '@nebular/theme';
import { ColorPickerModule, ColorPickerService } from 'ngx-color-picker';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { KnowledgeBaseComponent } from './knowledeg-base.component';
import { LanguageSelectorModule } from '../../language/language-selector';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbToggleModule,
		ColorPickerModule,
		I18nTranslateModule.forChild(),
		LanguageSelectorModule
	],
	declarations: [KnowledgeBaseComponent],
	exports: [KnowledgeBaseComponent],
	providers: [ColorPickerService]
})
export class KnowledgeBaseModule {}
