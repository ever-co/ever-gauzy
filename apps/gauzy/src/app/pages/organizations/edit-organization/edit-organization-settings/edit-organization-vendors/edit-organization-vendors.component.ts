import { Component, Input, OnInit } from '@angular/core';
import { OrganizationVendors } from '@gauzy/models';
import { OrganizationVendorsService } from 'apps/gauzy/src/app/@core/services/organization-vendors.service';

@Component({
	selector: 'ga-edit-org-vendors',
	templateUrl: './edit-organization-vendors.component.html'
})
export class EditOrganizationVendorsComponent implements OnInit {
	@Input()
	organizationId: string;

	showAddCard: boolean;

	vendors: OrganizationVendors[];

	constructor(
		private readonly organizationVendorsService: OrganizationVendorsService
	) {}

	ngOnInit(): void {
		this.loadVendors();
	}

	async removeVendor(id: string) {
		await this.organizationVendorsService.delete(id);

		this.loadVendors();
	}

	private async addVendor(name: string) {
		await this.organizationVendorsService.create({
			name,
			organizationId: this.organizationId
		});

		this.showAddCard = !this.showAddCard;
		this.loadVendors();
	}

	private async loadVendors() {
		const res = await this.organizationVendorsService.getAll(null, {
			organizationId: this.organizationId
		});
		if (res) {
			this.vendors = res.items;
		}
	}
}
