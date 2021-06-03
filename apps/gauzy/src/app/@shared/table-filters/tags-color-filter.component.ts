import {Component, OnChanges, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { ITag } from '@gauzy/contracts';

@Component({
    template: `
        <ga-tags-color-input
            (selectedTagsEvent)="selectedTagsEvent($event)"
            [multiple]="true"
            [isOrgLevel]="true"
            [label]="false"
        >
        </ga-tags-color-input>
    `,
})
export class TagsColorFilterComponent extends DefaultFilter implements OnChanges {
    
    constructor() {
        super();
    }

    ngOnChanges(changes: SimpleChanges) {}

    onChange(event) {
        this.column.filterFunction(event);
    }

    selectedTagsEvent(currentTagSelection: ITag[]) {
        this.column.filterFunction(currentTagSelection);
	}
}