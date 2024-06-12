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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { LanguageSelectorModule } from '@gauzy/ui-sdk/shared';
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
		I18nTranslateModule.forChild(),
		LanguageSelectorModule
	],
	declarations: [KnowledgeBaseComponent],
	exports: [KnowledgeBaseComponent],
	providers: [ColorPickerService]
})
export class KnowledgeBaseModule {}
