import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { NotesWithTagsComponent } from '../../../@shared';

@Component({
	selector: 'ngx-tags-color',
	templateUrl: './tags-color.component.html',
	styleUrls: ['./tags-color.component.scss']
})
export class TagsColorComponent
	extends NotesWithTagsComponent
	implements ViewCell
{
	@Input()
	value: string | number;
	rowData: any;
}
