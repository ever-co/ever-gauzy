import { Component, OnInit } from '@angular/core';
import { OrganizationVendors } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { OrganizationVendorsService } from 'apps/gauzy/src/app/@core/services/organization-vendors.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-edit-org-vendors',
	templateUrl: './edit-organization-vendors.component.html'
})
export class EditOrganizationVendorsComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;

	vendors: OrganizationVendors[];

	constructor(
		private readonly organizationVendorsService: OrganizationVendorsService,
		private readonly toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore
	) {}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadVendors();
				}
			});
	}

	async removeVendor(id: string, name: string) {
		await this.organizationVendorsService.delete(id);

		this.toastrService.primary(
			`Vendor ${name} successfully removed!`,
			'Success'
		);

		this.loadVendors();
	}

	private async addVendor(name: string) {
		if (name) {
			await this.organizationVendorsService.create({
				name,
				organizationId: this.organizationId
			});

			this.toastrService.primary(
				`New vendor ${name} successfully added!`,
				'Success'
			);

			this.showAddCard = !this.showAddCard;
			this.loadVendors();
		} else {
			// TODO translate
			this.toastrService.danger(
				'Please add a Vendor name',
				'Vendor name is required'
			);
		}
	}

	private async loadVendors() {
		if (!this.organizationId) {
			return;
		}

		const res = await this.organizationVendorsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.vendors = res.items;
		}
	}
}
