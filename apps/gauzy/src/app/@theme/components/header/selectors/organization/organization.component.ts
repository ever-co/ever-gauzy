import { Component, OnInit } from '@angular/core';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';
import { Organization } from '@gauzy/models';

@Component({
  selector: 'ga-organization-selector',
  templateUrl: './organization.component.html',
})
export class OrganizationSelectorComponent implements OnInit {
  organizations: Organization[]
  selectedOrganizationId: string;

  constructor(private organizationsService: OrganizationsService) {
  }

  ngOnInit(): void {
    this.loadOrganizations();
  }

  private async loadOrganizations(): Promise<void> {
    const { items = [] } = await this.organizationsService.getAll();

    if (items.length > 0) {
      // set first organizations as default
      this.selectedOrganizationId = items[0].id;
    }

    this.organizations = items;
  }
}