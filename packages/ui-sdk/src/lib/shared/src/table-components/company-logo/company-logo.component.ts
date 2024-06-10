import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-company-logo',
	templateUrl: './company-logo.component.html',
	styleUrls: ['./company-logo.component.scss']
})
export class CompanyLogoComponent {
	@Input() value: string | number;
	@Input() rowData: any;
}
