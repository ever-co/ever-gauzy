import { Component, Input } from '@angular/core';
import { IDeal } from '@gauzy/contracts';

@Component({
	selector: 'ga-pipeline-excerpt',
	template: `{{ rowData?.stage?.name }}`
})
export class PipelineDealExcerptComponent {
	@Input()
	value: string | number;

	@Input()
	rowData: IDeal;
}
