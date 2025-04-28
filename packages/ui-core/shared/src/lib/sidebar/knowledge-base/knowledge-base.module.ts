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
import { ColorPickerComponent, ColorPickerDirective, ColorPickerService } from 'ngx-color-picker';
import { TranslateModule } from '@ngx-translate/core';
import { KnowledgeBaseComponent } from './knowledge-base.component';
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
		ColorPickerComponent,
		ColorPickerDirective,
		TranslateModule.forChild(),
		LanguageSelectorModule
	],
	declarations: [KnowledgeBaseComponent],
	exports: [KnowledgeBaseComponent],
	providers: [ColorPickerService]
})
export class KnowledgeBaseModule {}
