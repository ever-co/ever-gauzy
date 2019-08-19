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
  selectedOrganizationId: string;

  private _ngDestroy$ = new Subject<void>();

  constructor(
    private organizationsService: OrganizationsService,
    private store: Store
  ) { }

  ngOnInit() {
    this.loadOrganizationsId();
    this.loadOrganizations();
  }

  selectOrganiztion({ id }) {
    if (id) {
      this.store.selectedOrganizationId = id
    }
  }

  private async loadOrganizations(): Promise<void> {
    const { items = [] } = await this.organizationsService.getAll();

    if (items.length > 0 && !this.store.selectedOrganizationId) {
      // set first organizations as default
      this.store.selectedOrganizationId = items[0].id
    }

    this.organizations = items;
  }

  private loadOrganizationsId(): void {
    this.store.selectedOrganizationId$
      .pipe(takeUntil(this._ngDestroy$))
      .subscribe((id: string) => {
        this.selectedOrganizationId = id;
      })
  }

  ngOnDestroy() {
    this._ngDestroy$.next();
    this._ngDestroy$.complete();
  }
}