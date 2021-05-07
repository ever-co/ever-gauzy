import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbSelectModule,
	NbInputModule,
	NbToggleModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ColorPickerModule, ColorPickerService } from 'ngx-color-picker';
import { TranslateModule } from '../../translate/translate.module';
import { LanguageInputModule } from '../../language/language-input/language-input.module';
import { KnowledgeBaseComponent } from './knowledeg-base.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		NbSelectModule,
		NbToggleModule,
		FormsModule,
		ReactiveFormsModule,
		ColorPickerModule,
		TranslateModule,
		LanguageInputModule,
		SharedModule
	],
	declarations: [KnowledgeBaseComponent],
	exports: [KnowledgeBaseComponent],
	providers: [ColorPickerService]
})
export class KnowledgeBaseModule {}
