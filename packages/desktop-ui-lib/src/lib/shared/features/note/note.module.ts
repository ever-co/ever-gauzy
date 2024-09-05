import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TextAreaModule } from '../../components/ui/text-area/text-area.module';
import { NoteComponent } from './note.component';

@NgModule({
	declarations: [NoteComponent],
	exports: [NoteComponent],
	imports: [CommonModule, TextAreaModule]
})
export class NoteModule {}
