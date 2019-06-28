import { Component } from '@angular/core';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';

@Component({
  selector: 'ga-organization-selector',
  templateUrl: './organization.component.html',
})
export class OrganizationSelectorComponent {
  allOrganizations$ = this.organizationsService.getAll();
  
  selectedOrganizationId: string;

  constructor(private organizationsService: OrganizationsService) { }
}