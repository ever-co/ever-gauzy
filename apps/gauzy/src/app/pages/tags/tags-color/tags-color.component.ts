import { Component, Input } from '@angular/core';
import { NotesWithTagsComponent } from '@gauzy/ui-core/shared';

@Component({
    selector: 'ngx-tags-color',
    templateUrl: './tags-color.component.html',
    styleUrls: ['./tags-color.component.scss'],
    standalone: false
})
export class TagsColorComponent extends NotesWithTagsComponent {
	@Input() value: string | number;
	@Input() rowData: any;
}
