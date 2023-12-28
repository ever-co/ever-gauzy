import { Component, Input } from '@angular/core';

@Component({
	selector: 'ngx-auto-approve',
	templateUrl: './auto-approve.component.html'
})
export class AutoApproveComponent {
	@Input()
	value: string | number;
	rowData: any;
}
