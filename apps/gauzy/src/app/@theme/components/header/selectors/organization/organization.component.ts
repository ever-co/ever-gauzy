import { Component } from '@angular/core';
import { Organization } from '@gauzy/models';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';

@Component({
  selector: 'ea-organization-selector',
  templateUrl: './organization.component.html',
})
export class OrganizationSelectorComponent {
  allOrganizations$ = this.organizationsService.getAll();
  
  selectedOrganizationId: string;

  constructor(private organizationsService: OrganizationsService) { }
}