import { Component, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { IOrganization } from '../../../../../../../packages/contracts/dist/organization.model';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'ngx-project',
	templateUrl: './project.component.html',
	styleUrls: ['./project.component.scss']
})
export class ProjectComponent implements OnInit, ViewCell {
	value: any;
	rowData: any;
	organization: Promise<IOrganization> | null = null;
	employees: any[] = [];
	constructor(private readonly organizationService: OrganizationsService) {}

	ngOnInit(): void {
		this.init();
		if (this.value.organizationId)
			this.organization = firstValueFrom(
				this.organizationService.getById(this.value.organizationId)
			);
	}

	init() {
		if (this.rowData.employeesMergedTeams) {
			const buffers = this.rowData.employeesMergedTeams[1];
			if (buffers) {
				for (let buffer of buffers) {
					for (let member of buffer.members) {
						this.employees.push(member.employee);
					}
				}
			}
		}
	}
}
