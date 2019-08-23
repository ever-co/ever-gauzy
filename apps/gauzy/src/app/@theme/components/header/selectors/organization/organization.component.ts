import { Component, OnInit, OnDestroy } from '@angular/core';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';
import { Organization } from '@gauzy/models';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';

@Component({
  selector: 'ga-organization-selector',
  templateUrl: './organization.component.html',
  styleUrls: ['./organization.component.scss'],

})
export class OrganizationSelectorComponent implements OnInit, OnDestroy {
  organizations: Organization[];
  selectedOrganization: Organization;

  private _ngDestroy$ = new Subject<void>();

  constructor(
    private organizationsService: OrganizationsService,
    private store: Store
  ) { }

  ngOnInit() {
    this.loadOrganizationsId();
    this.loadOrganizations();
  }

  selectOrganiztion(organization: Organization) {
    if (organization) {
      this.store.selectedOrganization = organization;
    }
  }

  private async loadOrganizations(): Promise<void> {
    const { items = [] } = await this.organizationsService
      .getAll()
      .pipe(first())
      .toPromise();

    if (items.length > 0 && !this.store.selectedOrganization) {
      // set first organizations as default
      this.store.selectedOrganization = items[0];
    }
    
    this.organizations = items;
  }

  private loadOrganizationsId(): void {
    this.store.selectedOrganization$
      .pipe(takeUntil(this._ngDestroy$))
      .subscribe((organization: Organization) => {
        this.selectedOrganization = organization;
      })
  }

  ngOnDestroy() {
    this._ngDestroy$.next();
    this._ngDestroy$.complete();
  }
}