import { Component, Input, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
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
		private readonly organizationVendorsService: OrganizationVendorsService,
		private readonly toastrService: NbToastrService
	) {}

	ngOnInit(): void {
		this.loadVendors();
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
			this.toastrService.danger(
				'Please add a Vendor name',
				'Vendor name is required'
			);
		}
	}

	private async loadVendors() {
		const res = await this.organizationVendorsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.vendors = res.items;
		}
	}
}
