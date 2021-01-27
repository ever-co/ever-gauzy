import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { IDeal } from '@gauzy/contracts';

@Component({
	selector: 'ga-pipeline-deal-created-by',
	template: `{{ rowData?.createdBy?.firstName }}
		{{ rowData?.createdBy?.lastName }}`
})
export class PipelineDealCreatedByComponent implements ViewCell {
	@Input()
	value: string | number;

	@Input()
	rowData: IDeal;
}
