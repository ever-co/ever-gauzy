import { Component, Input } from '@angular/core';

@Component({
	selector: 'ngx-equipment-sharing-policy',
	templateUrl: './equipment-sharing-policy.component.html'
})
export class EquipmentSharingPolicyComponent {
	@Input()
	rowData: any;

	value: any;
}
