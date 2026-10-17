import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { IOrganization, IProject } from '@gauzy/contracts';

@Component({
    selector: 'gauzy-project-organization',
    templateUrl: './project-organization.component.html',
    styleUrls: ['./project-organization.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProjectOrganizationComponent implements OnInit {
	@Input()
	value: any;
	@Input()
	rowData: any;
	organization: Promise<IOrganization> | null = null;
	count: number;
	project: IProject = {
		name: null,
		count: null,
		imageUrl: null
	};
	constructor() {}

	ngOnInit(): void {
		this.project.name = this.rowData.name;
		this.project.count = this.rowData.membersCount;
		this.project.imageUrl = this.rowData.imageUrl;
	}
}
