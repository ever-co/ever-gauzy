import { Component, Input, OnInit } from '@angular/core';
import { IOrganization, IProject } from '@gauzy/contracts';

@Component({
    selector: 'gauzy-project-organization',
    templateUrl: './project-organization.component.html',
    styleUrls: ['./project-organization.component.scss'],
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
