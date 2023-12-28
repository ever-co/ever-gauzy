import { Component, Input } from '@angular/core';
import { NotesWithTagsComponent } from '../../../@shared';

@Component({
	selector: 'ngx-tags-color',
	templateUrl: './tags-color.component.html',
	styleUrls: ['./tags-color.component.scss']
})
export class TagsColorComponent extends NotesWithTagsComponent {

	@Input() value: string | number;
	rowData: any;
}
