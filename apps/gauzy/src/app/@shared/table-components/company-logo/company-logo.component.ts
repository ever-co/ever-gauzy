import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ga-company-logo',
	templateUrl: './company-logo.component.html',
	styleUrls: ['./company-logo.component.scss']
})
export class CompanyLogoComponent implements ViewCell {
	value: string | number;
	@Input() rowData: any;
}
