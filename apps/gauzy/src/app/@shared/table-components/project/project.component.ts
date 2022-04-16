import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { firstValueFrom } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';

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
	constructor(private readonly organizationService: OrganizationsService) {}

	ngOnInit(): void {
		this.init();
		if (this.value.organizationId)
			this.organization = firstValueFrom(
				this.organizationService.getById(this.value.organizationId)
			);
	}

	init() {
		let count: number = 0;
		if (this.rowData.employeesMergedTeams) {
			const buffers = this.rowData.employeesMergedTeams[1];
			if (buffers.length > 0) {
				for (let buffer of buffers) {
					count += buffer.members ? buffer.members.length : 0;
				}
			} else {
				count = this.rowData.members.length;
			}
		}
		this.count = count;
	}
}
