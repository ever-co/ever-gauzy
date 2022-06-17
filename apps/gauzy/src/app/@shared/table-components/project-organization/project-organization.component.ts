import { Component, Input, OnInit } from '@angular/core';
import { IOrganization, IProject } from 'packages/contracts/dist';

@Component({
  selector: 'gauzy-project-organization',
  templateUrl: './project-organization.component.html',
  styleUrls: ['./project-organization.component.scss']
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
		organization: null
	};
  constructor() { }

  ngOnInit(): void {
    this.project.name = this.rowData.name;
    this.project.count = this.rowData.membersCount;
    this.project.organization = this.rowData.organization;
  }

}
