import { Component, Input } from '@angular/core';

@Component({
	selector: 'ngx-created-at',
	templateUrl: './created-at.component.html',
	styleUrls: ['./created-at.component.scss']
})
export class CreatedAtComponent {
	@Input() value: Date;

	@Input()
	rowData: any;
}
