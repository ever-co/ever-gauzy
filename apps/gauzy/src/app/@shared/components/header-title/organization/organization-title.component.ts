import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization } from 'packages/contracts/dist';
import { tap } from 'rxjs/operators';
import { Store } from './../../../../@core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-organization-title',
	templateUrl: './organization-title.component.html',
	styleUrls: []
})
export class OrganizationTitleComponent implements OnInit {
	
	organization: IOrganization;

	constructor(
		private readonly store: Store,
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				tap((organization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
