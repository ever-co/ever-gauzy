import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';

@NgModule({
	declarations: [RichTextEditorComponent, RichTextToolbarComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbTooltipModule,
		TranslateModule
	],
	exports: [RichTextEditorComponent, RichTextToolbarComponent]
})
export class RichTextEditorModule {}
