import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	templateUrl: './paid-icon.html',
	styleUrls: ['./paid-icon.scss']
})
export class PaidIcon implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
