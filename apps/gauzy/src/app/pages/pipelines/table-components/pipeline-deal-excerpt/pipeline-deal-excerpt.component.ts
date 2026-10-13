import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { IDeal } from '@gauzy/contracts';

@Component({
    selector: 'ga-pipeline-excerpt',
    template: `{{ rowData?.stage?.name }}`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PipelineDealExcerptComponent {
	@Input()
	value: string | number;

	@Input()
	rowData: IDeal;
}
