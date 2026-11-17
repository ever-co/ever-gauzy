import { Component, OnChanges, type SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { ITag } from '@gauzy/contracts';

@Component({
	selector: 'ga-tag-color-filter',
	template: `
		<ga-tags-color-input
			(selectedTagsEvent)="selectedTagsEvent($event)"
			[selectedTags]="selectedTags"
			[multiple]="true"
			[isOrgLevel]="true"
			[label]="false"
		></ga-tags-color-input>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TagsColorFilterComponent extends RestorableFilterComponent<ITag[]> implements OnChanges {
	constructor() {
		super();
	}

	private readonly _none: ITag[] = [];

	/** The tags the input shows: the ones restored by Back, none otherwise (one array, so the input is not rewritten). */
	get selectedTags(): ITag[] {
		return this.restored ?? this._none;
	}

	ngOnChanges(changes: SimpleChanges) {}

	/**
	 *
	 * @param tags
	 */
	selectedTagsEvent(value: ITag[]) {
		this.applyFilter(value);
	}
}
