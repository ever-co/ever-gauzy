import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { ITag } from '@gauzy/contracts';

@Component({
    template: `
        <ga-tags-color-input
            (selectedTagsEvent)="selectedTagsEvent($event)"
            [multiple]="true"
            [isOrgLevel]="true"
            [label]="false"
        ></ga-tags-color-input>
    `,
})
export class TagsColorFilterComponent extends DefaultFilter implements OnChanges {

    constructor() {
        super();
    }

    ngOnChanges(changes: SimpleChanges) { }

    /**
     *
     * @param event
     */
    onChange(event) {
        // this.column.filterFunction(event);
    }

    /**
     *
     * @param currentTagSelection
     */
    selectedTagsEvent(currentTagSelection: ITag[]) {
        // this.column.filterFunction(currentTagSelection);
    }
}
