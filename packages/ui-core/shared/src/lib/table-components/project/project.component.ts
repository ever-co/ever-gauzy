import { Component, Input, OnInit } from '@angular/core';
import { IOrganization, IProject } from '@gauzy/contracts';

@Component({
    selector: 'ngx-project',
    templateUrl: './project.component.html',
    styleUrls: ['./project.component.scss'],
    standalone: false
})
export class ProjectComponent implements OnInit {
	@Input() value: any;
	@Input() rowData: any;
	organization: Promise<IOrganization> | null = null;
	count: number;
	project: IProject = {
		name: null,
		count: null,
		imageUrl: null
	};

	projects: IProject[] = [];

	constructor() { }

	ngOnInit(): void {
		this.init();
	}

	public async init() {
		if (this.rowData?.project || this.value?.project) {
			this.project.name = this.rowData?.project?.name || this.value?.project?.name;
			this.project.count = this.rowData?.project?.membersCount || this.value?.project?.membersCount;
			this.project.imageUrl = this.rowData?.project?.imageUrl || this.value?.project?.imageUrl;
		} else if (this.rowData.projects) {
			this.projects = this.rowData.projects.map((project: any) => {
				return {
					name: project.name,
					count: project.membersCount,
					imageUrl: project.imageUrl
				};
			});
		}
	}
}
