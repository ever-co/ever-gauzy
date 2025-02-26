import { Component, Input } from '@angular/core';

@Component({
    template: `
		<div>
			<a
				class="link-text mr-2 mb-2"
				*ngFor="let client of rowData.clientNames"
			>
				<span>{{ client.substr(0, 2).toUpperCase() }}</span>
				{{ client }}
			</a>
		</div>
	`,
    styleUrls: ['./client-names.component.scss'],
    standalone: false
})
export class ClientNamesComponent {
	@Input()
	rowData: any;

	value: string | number;
}
