import { Component, Input } from "@angular/core";
import { IOrganizationProject } from "@gauzy/contracts";

@Component({
	selector: 'ga-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent {
	@Input() members: number
	@Input() project: IOrganizationProject
}