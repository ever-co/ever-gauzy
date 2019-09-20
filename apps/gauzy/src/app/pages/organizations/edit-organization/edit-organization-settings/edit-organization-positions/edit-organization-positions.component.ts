import { Component, Input, OnInit } from '@angular/core';
import { OrganizationPositions } from '@gauzy/models';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';

@Component({
	selector: 'ga-edit-org-positions',
	templateUrl: './edit-organization-positions.component.html'
})
export class EditOrganizationPositionsComponent implements OnInit {
	@Input()
	organizationId: string;

	showAddCard: boolean;

	positions: OrganizationPositions[];

	constructor(
		private readonly organizationPositionsService: OrganizationPositionsService
	) {}

	ngOnInit(): void {
		this.loadPositions();
	}

	async removePosition(id: string) {
		await this.organizationPositionsService.delete(id);

		this.loadPositions();
	}

	private async addPosition(name: string) {
		await this.organizationPositionsService.create({
			name,
			organizationId: this.organizationId
		});

		this.showAddCard = !this.showAddCard;
		this.loadPositions();
	}

	private async loadPositions() {
		const res = await this.organizationPositionsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.positions = res.items;
		}
	}
}
