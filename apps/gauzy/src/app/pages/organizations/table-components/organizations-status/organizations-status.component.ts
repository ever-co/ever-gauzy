import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    templateUrl: './organizations-status.component.html',
    styleUrls: ['./organizations-status.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class OrganizationsStatusComponent {
	@Input()
	rowData: any;

	value: string | number;
}
