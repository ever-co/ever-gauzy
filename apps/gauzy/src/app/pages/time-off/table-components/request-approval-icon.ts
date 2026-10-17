import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    templateUrl: './request-approval-icon.html',
    styleUrls: ['./request-approval-icon.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class RequestApprovalIcon {
	@Input() rowData: any;
	@Input() value: string | number;
}
