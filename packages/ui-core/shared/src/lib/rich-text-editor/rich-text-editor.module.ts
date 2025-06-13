import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxEditorModule } from 'ngx-editor';
import { RichTextEditorComponent } from './rich-text-editor.component';

@NgModule({
	declarations: [RichTextEditorComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxEditorModule],
	exports: [RichTextEditorComponent, NgxEditorModule]
})
export class RichTextEditorModule {}
