import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `
		<div class="text-center">
			<strong class="d-block">
				{{ rowData.source?.name }}
			</strong>
		</div>
	`
})
export class CandidateSourceComponent implements ViewCell {
	@Input()
	rowData: any;
	value: string | number;
}
