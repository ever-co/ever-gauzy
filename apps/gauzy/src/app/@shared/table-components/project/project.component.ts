import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { firstValueFrom, tap } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';

interface IProject {
	name: string;
	count: number;
	organization: Promise<IOrganization> | null;
}

@Component({
	selector: 'ngx-project',
	templateUrl: './project.component.html',
	styleUrls: ['./project.component.scss']
})
export class ProjectComponent implements OnInit, ViewCell {
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

	projects: IProject[] = [];

	constructor(private readonly organizationService: OrganizationsService) {}

	ngOnInit(): void {
		this.init();
	}

	public async init() {
		if (this.rowData.project) {
			this.project.name = this.rowData.project.name;
			this.project.count = this.rowData.project.membersCount;
			this.project.organization = firstValueFrom(
				this.organizationService.getById(
					this.rowData.project.organizationId
				)
			);
		} else if (this.rowData.projects) {
			this.projects = this.rowData.projects.map((project: any) => {
				return {
					name: project.name,
					count: project.membersCount,
					organization: firstValueFrom(
						this.organizationService.getById(project.organizationId)
					)
				};
			});
		}
	}
}
