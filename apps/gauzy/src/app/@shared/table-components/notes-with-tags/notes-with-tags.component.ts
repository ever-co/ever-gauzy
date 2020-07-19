import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ComponentLayoutStyleEnum } from '@gauzy/models';

@Component({
	selector: 'ga-notes-with-tags',
	templateUrl: './notes-with-tags.component.html',
	styleUrls: ['./notes-with-tags.component.scss']
})
export class NotesWithTagsComponent implements ViewCell {
	@Input()
	rowData: any;

	@Input()
	value: string | number;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;
}
