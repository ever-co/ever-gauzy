import { Component, OnInit, OnDestroy, TemplateRef } from '@angular/core';
import { IOrganizationPosition, ITag, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { LocalDataSource } from 'angular2-smart-table';
import { firstValueFrom, filter, tap, Subject, debounceTime } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { OrganizationPositionsService, Store, ToastrService } from '../../@core/services';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../@shared/pagination/pagination-filter-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-positions',
	templateUrl: './positions.component.html',
	styleUrls: ['positions.component.scss']
})
export class PositionsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
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
	selected = {
		position: null,
		state: false
	};
	disabled: boolean = true;
	loading: boolean = false;
	private _refresh$: Subject<any> = new Subject();

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
		this.subject$
			.pipe(
				debounceTime(150),
				tap(() => this.loadPositions()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(150),
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(300),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.positions = [])),
				untilDestroyed(this)
			)
			.subscribe();
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngOnDestroy(): void {}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			pager: {
				perPage: pagination ? pagination : 10
			},
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
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.EMPLOYEE_POSITION')
				}
			}).onClose
		);

		if (result) {
			await this.organizationPositionsService.delete(id);

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.REMOVE_POSITION', { name });

			this._refresh$.next(true);
			this.subject$.next(true);
			this.cancel();
		}
	}

	private get _isGridLayout(): boolean {
		return this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle;
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
				tap(() => this.refreshPagination()),
				tap(() => (this.positions = [])),
				tap(() => this.subject$.next(true)),
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

		this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.UPDATED_POSITION', { name });
		this.subject$.next(true);
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

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.ADD_POSITION', { name });
			this._refresh$.next(true);
			this.subject$.next(true);
			this.cancel();
		} else {
			// TODO translate
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.INVALID_POSITION_NAME',
				this.getTranslation('TOASTR.MESSAGE.NEW_ORGANIZATION_POSITION_INVALID_NAME')
			);
		}
	}

	cancel() {
		this.showEditDiv = false;
		this.showAddCard = false;
		this.selectedPosition = null;
		this.isGridEdit = false;
		this.tags = [];
		this.selected = {
			position: null,
			state: false
		};
		this.disabled = true;
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
		this.loading = true;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { activePage, itemsPerPage } = this.getPagination();

		const res = await this.organizationPositionsService.getAll(
			{
				organizationId,
				tenantId
			},
			['tags']
		);
		if (res) {
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			this.smartTableSource.load(res.items);
			if (this._isGridLayout) {
				this._loadGridLayoutData();
			} else this.positions = res.items;
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});
			if (this.positions.length <= 0) {
				this.positionsExist = false;
			} else {
				this.positionsExist = true;
			}
			this.emptyListInvoke();
			this.loading = false;
		}
	}

	private async _loadGridLayoutData() {
		this.positions.push(...(await this.smartTableSource.getElements()));
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

	openDialog(template: TemplateRef<any>, isEditTemplate: boolean) {
		try {
			isEditTemplate ? this.edit(this.selectedPosition) : this.cancel();
			this.dialogService.open(template);
		} catch (error) {
			console.log('An error occurred on open dialog');
		}
	}

	selectPosition(position: any) {
		if (position.data) position = position.data;
		const res =
			this.selected.position && position.id === this.selected.position.id
				? { state: !this.selected.state }
				: { state: true };
		this.disabled = !res.state;
		this.selected.state = res.state;
		this.selected.position = position;
		this.selectedPosition = this.selected.position;
	}
}
