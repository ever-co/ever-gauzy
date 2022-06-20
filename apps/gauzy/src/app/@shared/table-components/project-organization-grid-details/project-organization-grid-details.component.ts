import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'gauzy-project-organization-grid-details',
	templateUrl: './project-organization-grid-details.component.html',
	styleUrls: ['./project-organization-grid-details.component.scss']
})
export class ProjectOrganizationGridDetailsComponent implements ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;
}
