import { Component, Input } from '@angular/core';

@Component({
    selector: 'ngx-equipment-sharing-policy-table-selector',
    templateUrl: './equipment-sharing-policy.component.html',
    standalone: false
})
export class EquipmentSharingPolicyTableComponent {
	@Input()
	rowData: any;

	value: any;
}
