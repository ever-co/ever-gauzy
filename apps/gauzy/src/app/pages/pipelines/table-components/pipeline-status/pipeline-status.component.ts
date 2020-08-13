import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { Pipeline } from '@gauzy/models';

@Component({
	selector: 'ga-pipeline-status',
	templateUrl: './pipeline-status.component.html'
})
export class PipelineStatusComponent implements ViewCell {
	@Input()
	value: string | number;

	@Input()
    rowData: Pipeline;
}
