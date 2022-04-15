import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	IOrganizationPosition,
	ITag,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange } from '@gauzy/common-angular';
import { LocalDataSource } from 'ng2-smart-table';
import { firstValueFrom, filter, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { OrganizationPositionsService, Store, ToastrService } from '../../@core/services';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-positions',
	templateUrl: './positions.component.html',
	styleUrls: ['positions.component.scss']
})
export class PositionsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {

	showAddCard: boolean;
	positions: IOrganizationPosition[];
	selectedPosition: IOrganizationPosition;
	showEditDiv: boolean;
	positionsExist: boolean;
	tags: ITag[] = [];
	isGridEdit: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	organization: IOrganization;

	constructor(
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.loadPositions()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void { }

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			}
		};
	}

	async removePosition(id: string, name: string) {
		const result = await firstValueFrom(
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType: this.getTranslation(
							'ORGANIZATIONS_PAGE.EDIT.EMPLOYEE_POSITION'
						)
					}
				})
				.onClose
		);

		if (result) {
			await this.organizationPositionsService.delete(id);

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.REMOVE_POSITION',
				{ name }
			);

			this.loadPositions();
		}
	}

	edit(position: IOrganizationPosition) {
		this.showAddCard = true;
		this.isGridEdit = true;
		this.selectedPosition = position;
		this.tags = position.tags;
	}

	setView() {
		this.viewComponentName = ComponentEnum.POSITIONS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				untilDestroyed(this)
			)
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedPosition = null;

				//when layout selector change then hide edit show card
				this.showAddCard = false;
			});
	}

	save(name: string) {
		if (this.isGridEdit) {
			this.editPosition(this.selectedPosition.id, name);
		} else {
			this.addPosition(name);
		}
	}

	async editPosition(id: string, name: string) {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		await this.organizationPositionsService.update(id, {
			name: name,
			organizationId,
			tenantId,
			tags: this.tags
		});
		this.loadPositions();
		this.toastrService.success(
			'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.UPDATED_POSITION',
			{ name }
		);
		this.cancel();
	}

	private async addPosition(name: string) {
		if (name) {
			if (!this.organization) {
				return;
			}
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			await this.organizationPositionsService.create({
				name,
				organizationId,
				tenantId,
				tags: this.tags
			});

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.ADD_POSITION',
				{ name }
			);

			this.loadPositions();
			this.cancel();
		} else {
			// TODO translate
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.INVALID_POSITION_NAME',
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_POSITION_INVALID_NAME'
				)
			);
		}
	}

	cancel() {
		this.showEditDiv = false;
		this.showAddCard = false;
		this.selectedPosition = null;
		this.isGridEdit = false;
		this.tags = [];
	}

	showEditCard(position: IOrganizationPosition) {
		this.tags = position.tags;
		this.showEditDiv = true;
		this.selectedPosition = position;
	}

	private async loadPositions() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const res = await this.organizationPositionsService.getAll(
			{
				organizationId,
				tenantId
			},
			['tags']
		);
		if (res) {
			this.positions = res.items;
			this.smartTableSource.load(res.items);

			if (this.positions.length <= 0) {
				this.positionsExist = false;
			} else {
				this.positionsExist = true;
			}

			this.emptyListInvoke();
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * if empty employment levels then displayed add button
	 */
	private emptyListInvoke() {
		if (this.positions.length === 0) {
			this.cancel();
		}
	}
}
