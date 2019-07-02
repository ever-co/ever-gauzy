import { Component } from '@angular/core';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';

@Component({
  selector: 'ga-organization-selector',
  templateUrl: './organization.component.html',
  styleUrls: ['./organization.component.scss'],

})
export class OrganizationSelectorComponent {
  allOrganizations$ = this.organizationsService.getAll();

  selectedOrganizationId: string;

  constructor(private organizationsService: OrganizationsService) { }
}