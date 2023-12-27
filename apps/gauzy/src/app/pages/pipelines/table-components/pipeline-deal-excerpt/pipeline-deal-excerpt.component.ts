import { Component, Input } from '@angular/core';
import { ViewCell } from 'angular2-smart-table';
import { IDeal } from '@gauzy/contracts';

@Component({
	selector: 'ga-pipeline-excerpt',
	template: `{{ rowData?.stage.name }}`
})
export class PipelineDealExcerptComponent implements ViewCell {
	@Input()
	value: string | number;

	@Input()
	rowData: IDeal;
}
