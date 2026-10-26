import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    templateUrl: './paid-icon.html',
    styleUrls: ['./paid-icon.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PaidIcon {
	@Input()
	rowData: any;

	value: string | number;
}
