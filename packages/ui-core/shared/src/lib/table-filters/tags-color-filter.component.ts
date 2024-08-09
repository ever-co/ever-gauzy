import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { ITag } from '@gauzy/contracts';

@Component({
	selector: 'ga-tag-color-filter',
	template: `
		<ga-tags-color-input
			(selectedTagsEvent)="selectedTagsEvent($event)"
			[multiple]="true"
			[isOrgLevel]="true"
			[label]="false"
		></ga-tags-color-input>
	`
})
export class TagsColorFilterComponent extends DefaultFilter implements OnChanges {
	constructor() {
		super();
	}

	ngOnChanges(changes: SimpleChanges) {}

	/**
	 *
	 * @param tags
	 */
	selectedTagsEvent(value: ITag[]) {
		this.column.filterFunction(value, this.column.id);
	}
}
