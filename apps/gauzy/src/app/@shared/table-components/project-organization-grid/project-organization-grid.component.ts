import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'gauzy-project-organization-grid',
	templateUrl: './project-organization-grid.component.html',
	styleUrls: ['./project-organization-grid.component.scss']
})
export class ProjectOrganizationGridComponent implements ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;
}
