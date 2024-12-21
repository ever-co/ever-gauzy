import { Component, Input } from '@angular/core';

@Component({
    templateUrl: './request-approval-icon.html',
    styleUrls: ['./request-approval-icon.scss'],
    standalone: false
})
export class RequestApprovalIcon {
	@Input() rowData: any;
	@Input() value: string | number;
}
