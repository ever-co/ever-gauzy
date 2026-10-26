import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-equipment-sharing-policy-table-selector',
    templateUrl: './equipment-sharing-policy.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EquipmentSharingPolicyTableComponent {
	@Input()
	rowData: any;

	value: any;
}
