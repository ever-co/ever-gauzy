import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-auto-approve',
	templateUrl: './auto-approve.component.html'
})
export class AutoApproveComponent implements ViewCell {
	@Input()
	value: string | number;
	rowData: any;
}
