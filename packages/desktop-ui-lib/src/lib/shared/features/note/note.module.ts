import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { TextAreaModule } from '../../components/ui/text-area/text-area.module';
import { NoteSelectorQuery } from './+state/note-selector.query';
import { NoteSelectorStore } from './+state/note-selector.store';
import { NoteService } from './+state/note.service';
import { NoteComponent } from './note.component';

@NgModule({
	declarations: [NoteComponent],
	exports: [NoteComponent],
	imports: [CommonModule, TextAreaModule],
	providers: [NoteSelectorStore, NoteSelectorQuery, NoteService, TimeTrackerQuery]
})
export class NoteModule {}
