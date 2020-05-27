import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ga-notes-with-tags',
	templateUrl: './notes-with-tags.component.html',
	styleUrls: ['./notes-with-tags.component.scss'],
})
export class NotesWithTagsComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
