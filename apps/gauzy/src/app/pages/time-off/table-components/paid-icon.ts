import { Component, Input } from '@angular/core';

@Component({
	templateUrl: './paid-icon.html',
	styleUrls: ['./paid-icon.scss']
})
export class PaidIcon {
	@Input()
	rowData: any;

	value: string | number;
}
