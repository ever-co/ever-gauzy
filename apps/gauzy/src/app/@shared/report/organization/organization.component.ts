import { Component, Input } from "@angular/core";
import { IOrganizationProject } from "@gauzy/contracts";
import { DEFAULT_SVG } from "../../../@core/constants";

@Component({
	selector: 'ga-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent {

	fallbackSvg = DEFAULT_SVG;

	@Input() project: IOrganizationProject
	
	constructor() {}
}