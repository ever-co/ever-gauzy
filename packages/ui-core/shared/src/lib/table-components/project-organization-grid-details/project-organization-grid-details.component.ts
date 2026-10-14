import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'gauzy-project-organization-grid-details',
    templateUrl: './project-organization-grid-details.component.html',
    styleUrls: ['./project-organization-grid-details.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProjectOrganizationGridDetailsComponent {
	@Input()
	value: string | number;
	@Input()
	rowData: any;
}
