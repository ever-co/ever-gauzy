import { Component, Input } from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { NotesWithTagsComponent } from '../notes-with-tags/notes-with-tags.component';

@Component({
    selector: 'ga-only-tags',
    templateUrl: './tags-only.component.html',
    styleUrls: ['./tags-only.component.scss'],
    standalone: false
})
export class TagsOnlyComponent extends NotesWithTagsComponent {
	ComponentLayoutStyleEnum = ComponentLayoutStyleEnum;

	@Input() value: any;
}
