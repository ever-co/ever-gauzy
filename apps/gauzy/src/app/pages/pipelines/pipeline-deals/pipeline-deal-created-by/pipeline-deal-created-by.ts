import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { Deal } from '@gauzy/models';

@Component({
	selector: 'ga-pipeline-deal-created-by',
	template: `{{ rowData?.createdBy?.firstName }}
		{{ rowData?.createdBy?.lastName }}`
})
export class PipelineDealCreatedByComponent implements ViewCell {
	@Input()
	public value: string | number;

	@Input()
	public rowData: Deal;
}
