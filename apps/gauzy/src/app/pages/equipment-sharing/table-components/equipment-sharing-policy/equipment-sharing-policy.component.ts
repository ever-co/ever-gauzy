import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-equipment-sharing-policy',
	templateUrl: './equipment-sharing-policy.component.html'
})
export class EquipmentSharingPolicyComponent implements ViewCell {
	@Input()
	rowData: any;

	value: any;
}
