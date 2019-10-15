import { Component, Input, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
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
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly toastrService: NbToastrService
	) {}

	ngOnInit(): void {
		this.loadPositions();
	}

	async removePosition(id: string, name: string) {
		await this.organizationPositionsService.delete(id);

		this.toastrService.info(
			`Position ${name} successfuly removed!`,
			'Success'
		);

		this.loadPositions();
	}

	private async addPosition(name: string) {
		await this.organizationPositionsService.create({
			name,
			organizationId: this.organizationId
		});

		this.toastrService.info(
			`New position ${name} successfuly added!`,
			'Success'
		);

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
