import { Component, Input } from '@angular/core';
import { IDeal } from '@gauzy/contracts';

@Component({
    selector: 'ga-pipeline-deal-created-by',
    template: `{{ rowData?.createdBy?.name }}`,
    standalone: false
})
export class PipelineDealCreatedByComponent {
	@Input()
	value: string | number;

	@Input()
	rowData: IDeal;
}
