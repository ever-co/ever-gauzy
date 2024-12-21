import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-proposal-status',
    templateUrl: './proposal-status.component.html',
    styleUrls: ['./proposal-status.component.scss'],
    standalone: false
})
export class ProposalStatusComponent {
	@Input() rowData: any;
	@Input() value: string | number;
}
