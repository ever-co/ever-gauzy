import { Component, Input, OnInit } from "@angular/core";
import { IOrganizationProject } from "@gauzy/contracts";

@Component({
	selector: 'ga-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent implements OnInit {
	@Input() members: number
	@Input() project: IOrganizationProject
	
	ngOnInit () {
		console.log(this.project)
	}
}