import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-auto-approve',
    templateUrl: './auto-approve.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AutoApproveComponent {
	@Input() value: string | number;
	@Input() rowData: any;
}
