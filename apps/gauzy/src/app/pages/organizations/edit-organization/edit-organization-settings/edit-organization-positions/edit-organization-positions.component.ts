import { Component, OnInit } from '@angular/core';
import { OrganizationPositions, Tag } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-org-positions',
	templateUrl: './edit-organization-positions.component.html'
})
export class EditOrganizationPositionsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;

	positions: OrganizationPositions[];

	selectedPosition: OrganizationPositions;

	showEditDiv: boolean;

	positionsExist: boolean;
	tags: Tag[] = [];

	constructor(
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

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
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.REMOVE_POSITION',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.loadPositions();
	}

	async editPosition(id: string, name: string) {
		await this.organizationPositionsService.update(id, {
			name: name,
			tags: this.tags
		});
		this.loadPositions();
		this.toastrService.success('Successfully updated');
		this.showEditDiv = !this.showEditDiv;
	}

	private async addPosition(name: string) {
		if (name) {
			await this.organizationPositionsService.create({
				name,
				organizationId: this.organizationId,
				tags: this.tags
			});

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.ADD_POSITION',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddCard = !this.showAddCard;
			this.loadPositions();
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.INVALID_POSITION_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_POSITION_INVALID_NAME'
				)
			);
		}
	}

	cancel() {
		this.showEditDiv = !this.showEditDiv;
		this.selectedPosition = null;
	}

	showEditCard(position: OrganizationPositions) {
		this.tags = position.tags;
		this.showEditDiv = true;
		this.selectedPosition = position;
	}

	private async loadPositions() {
		const res = await this.organizationPositionsService.getAll(
			{
				organizationId: this.organizationId
			},
			['tags']
		);
		if (res) {
			this.positions = res.items;

			if (this.positions.length <= 0) {
				this.positionsExist = false;
			} else {
				this.positionsExist = true;
			}
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
