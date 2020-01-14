import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `
		<div>
			<div
				class="client-badge mr-2 mb-2 text-alternate"
				*ngFor="let client of rowData.clientNames"
			>
				{{ client }}
			</div>
		</div>
	`,
	styleUrls: ['./client-names.component.scss']
})
export class ClientNamesComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
