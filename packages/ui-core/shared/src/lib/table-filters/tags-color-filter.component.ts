import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { CustomFilterConfig, ITag } from '@gauzy/contracts';

@Component({
	selector: 'ga-tag-color-filter',
	template: `
		<ga-tags-color-input
			(selectedTagsEvent)="selectedTagsEvent($event)"
			[selectedTagsIds]="selectedTagsIds"
			[multiple]="true"
			[isOrgLevel]="true"
			[label]="false"
		></ga-tags-color-input>
	`,
	standalone: false
})
export class TagsColorFilterComponent extends DefaultFilter implements OnInit, OnChanges {
	selectedTagsIds: string[];

	constructor() {
		super();
	}

	ngOnInit(): void {
		const config = this.column?.filter?.config as CustomFilterConfig;
		if (config?.initialValueIds) {
			this.selectedTagsIds = config.initialValueIds;
		}
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
