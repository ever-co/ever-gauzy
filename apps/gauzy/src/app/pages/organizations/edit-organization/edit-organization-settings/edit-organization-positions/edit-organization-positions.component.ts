import { Component, OnInit } from '@angular/core';
import { OrganizationPositions } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-edit-org-positions',
	templateUrl: './edit-organization-positions.component.html'
})
export class EditOrganizationPositionsComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;

	positions: OrganizationPositions[];

	constructor(
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore
	) {}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadPositions();
				}
			});
	}

	async removePosition(id: string, name: string) {
		await this.organizationPositionsService.delete(id);

		this.toastrService.primary(
			`Position ${name} successfully removed!`,
			'Success'
		);

		this.loadPositions();
	}

	private async addPosition(name: string) {
		if (name) {
			await this.organizationPositionsService.create({
				name,
				organizationId: this.organizationId
			});

			this.toastrService.primary(
				`New position ${name} successfully added!`,
				'Success'
			);

			this.showAddCard = !this.showAddCard;
			this.loadPositions();
		} else {
			// TODO translate
			this.toastrService.danger(
				'Please add a Position name',
				'Position name is required'
			);
		}
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
