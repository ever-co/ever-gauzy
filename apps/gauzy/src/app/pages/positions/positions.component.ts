import { Component, OnInit } from '@angular/core';
import {
	OrganizationPositions,
	Tag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { LocalDataSource } from 'ng2-smart-table';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

@Component({
	selector: 'ga-positions',
	templateUrl: './positions.component.html'
})
export class PositionsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	organizationId: string;
	showAddCard: boolean;
	positions: OrganizationPositions[];
	selectedPosition: OrganizationPositions;
	showEditDiv: boolean;
	positionsExist: boolean;
	tags: Tag[] = [];
	isGridEdit: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	constructor(
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly toastrService: NbToastrService,
		private readonly store: Store,
		private dialogService: NbDialogService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.setView();
	}
	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadPositions();
					this.loadSmartTable();
					this._applyTranslationOnSmartTable();
				}
			});
	}
	async loadSmartTable() {
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
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Employee level'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
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
	}
	edit(position: OrganizationPositions) {
		this.showAddCard = true;
		this.isGridEdit = true;
		this.selectedPosition = position;
		this.tags = position.tags;
	}
	setView() {
		this.viewComponentName = ComponentEnum.POSITIONS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedPosition =
					this.dataLayoutStyle === 'CARDS_GRID'
						? null
						: this.selectedPosition;
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
		await this.organizationPositionsService.update(id, {
			name: name,
			tags: this.tags
		});
		this.loadPositions();
		this.toastrService.success('Successfully updated');
		this.cancel();
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

			this.loadPositions();
			this.cancel();
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
		this.showEditDiv = false;
		this.showAddCard = false;
		this.selectedPosition = null;
		this.isGridEdit = false;
		this.tags = [];
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
			this.smartTableSource.load(res.items);

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
	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}
