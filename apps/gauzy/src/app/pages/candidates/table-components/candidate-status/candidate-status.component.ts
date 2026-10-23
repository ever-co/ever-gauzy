import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    templateUrl: './candidate-status.component.html',
    styleUrls: ['./candidate-status.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CandidateStatusComponent {
	@Input() rowData: any;
	@Input() value: string | number;
}
