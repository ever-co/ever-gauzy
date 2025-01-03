import { Component, Input } from '@angular/core';

@Component({
    templateUrl: './candidate-status.component.html',
    styleUrls: ['./candidate-status.component.scss'],
    standalone: false
})
export class CandidateStatusComponent {
	@Input() rowData: any;
	@Input() value: string | number;
}
