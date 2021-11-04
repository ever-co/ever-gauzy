import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-only-tags',
	templateUrl: './tags-only.component.html',
	styleUrls: ['./tags-only.component.scss']
})
export class TagsOnlyComponent implements ViewCell {
	@Input()
	rowData: any;

	@Input()
	value: string | number;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;
}