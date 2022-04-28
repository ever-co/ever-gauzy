import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { NotesWithTagsComponent } from '../notes-with-tags/notes-with-tags.component';

@Component({
	selector: 'ga-only-tags',
	templateUrl: './tags-only.component.html',
	styleUrls: ['./tags-only.component.scss']
})
export class TagsOnlyComponent
	extends NotesWithTagsComponent
	implements ViewCell
{
	@Input()
	value: any;
}
