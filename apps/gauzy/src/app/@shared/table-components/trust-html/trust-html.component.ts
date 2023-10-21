import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-security-trust-html',
	templateUrl: './trust-html.component.html'
})
export class TrustHtmlLinkComponent implements ViewCell {

	@Input() value: string;
	@Input() rowData: any;
}
