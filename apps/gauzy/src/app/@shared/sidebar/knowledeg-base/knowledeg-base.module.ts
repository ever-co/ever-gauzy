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
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { LanguageSelectorModule } from '../../language/language-selector/language-selector.module';
import { KnowledgeBaseComponent } from './knowledeg-base.component';

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
		LanguageSelectorModule
	],
	declarations: [KnowledgeBaseComponent],
	exports: [KnowledgeBaseComponent],
	providers: [ColorPickerService]
})
export class KnowledgeBaseModule {}
