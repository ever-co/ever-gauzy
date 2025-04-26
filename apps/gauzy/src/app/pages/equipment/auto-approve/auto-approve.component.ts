import { Component, Input } from '@angular/core';

@Component({
    selector: 'ngx-auto-approve',
    templateUrl: './auto-approve.component.html',
    standalone: false
})
export class AutoApproveComponent {
	@Input() value: string | number;
	@Input() rowData: any;
}
