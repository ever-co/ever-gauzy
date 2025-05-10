import { Component, Input } from '@angular/core';

@Component({
    templateUrl: './paid-icon.html',
    styleUrls: ['./paid-icon.scss'],
    standalone: false
})
export class PaidIcon {
	@Input()
	rowData: any;

	value: string | number;
}
