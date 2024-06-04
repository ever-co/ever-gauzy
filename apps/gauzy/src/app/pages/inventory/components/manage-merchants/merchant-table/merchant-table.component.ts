import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { Cell } from 'angular2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { IMerchant, IOrganization, ComponentLayoutStyleEnum, IWarehouse } from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum } from '@gauzy/ui-sdk/common';
import { Store } from '@gauzy/ui-sdk/common';
import { MerchantService } from '@gauzy/ui-sdk/core';
import { ContactRowComponent, EnabledStatusComponent, ItemImgTagsComponent } from '../../inventory-table-components';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from './../../../../../@shared/pagination/pagination-filter-base.component';
import { ServerDataSource, ToastrService } from '@gauzy/ui-sdk/core';
import { DeleteConfirmationComponent } from './../../../../../@shared/user/forms';
import { InputFilterComponent } from './../../../../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-merchant-table',
	templateUrl: './merchant-table.component.html',
	styleUrls: ['./merchant-table.component.scss']
})
export class MerchantTableComponent extends PaginationFilterBaseComponent implements OnInit {
	settingsSmartTable: object;
	loading: boolean = false;
	selectedMerchant: IMerchant;
	smartTableSource: ServerDataSource;
	merchants: IMerchant[] = [];
	disableButton: boolean = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	merchants$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true })
	actionButtons: TemplateRef<any>;

	constructor(
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly http: HttpClient,
		private readonly toastrService: ToastrService,
		private readonly merchantService: MerchantService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	ngAfterViewInit(): void {
		this.merchants$
			.pipe(
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getMerchants()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.merchants$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		storeOrganization$
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.merchants$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.merchants = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.MERCHANTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.merchants = [])),
				tap(() => this.merchants$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			editable: true,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.MERCHANT'),
			columns: {
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'custom',
					renderComponent: ItemImgTagsComponent,
					componentInitFunction: (instance: ItemImgTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (name: string) => {
						this.setFilter({ field: 'name', search: name });
					}
				},
				code: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (code: string) => {
						this.setFilter({ field: 'code', search: code });
					}
				},
				contact: {
					title: this.getTranslation('INVENTORY_PAGE.CONTACT'),
					type: 'custom',
					filter: false,
					renderComponent: ContactRowComponent,
					componentInitFunction: (instance: ContactRowComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (value: string) => (value ? value.slice(0, 15) + '...' : '')
				},
				active: {
					title: this.getTranslation('INVENTORY_PAGE.ACTIVE'),
					type: 'custom',
					width: '5%',
					filter: false,
					renderComponent: EnabledStatusComponent,
					componentInitFunction: (instance: EnabledStatusComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onAddStoreClick() {
		this.router.navigate(['/pages/organization/inventory/merchants/create']);
	}

	onEditStore(selectedItem?: IMerchant) {
		if (selectedItem) {
			this.selectStore({
				isSelected: true,
				data: selectedItem
			});
		}

		this.router.navigate([`/pages/organization/inventory/merchants/edit`, this.selectedMerchant.id]);
	}

	async onDelete(selectedItem?: IMerchant) {
		if (selectedItem) {
			this.selectStore({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.selectedMerchant) {
			return;
		}

		const dialog = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

		if (dialog) {
			await this.merchantService
				.delete(this.selectedMerchant.id)
				.then((res) => {
					if (res && res['affected'] == 1) {
						const { name } = this.selectedMerchant;
						this.toastrService.success('INVENTORY_PAGE.MERCHANT_DELETED_SUCCESSFULLY', {
							name
						});
					}
				})
				.finally(() => {
					this._refresh$.next(true);
					this.merchants$.next(true);
				});
		}
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/merchants/pagination`,
				relations: ['logo', 'contact', 'tags', 'warehouses'],
				where: {
					organizationId,
					tenantId,
					...(this.filters.where ? this.filters.where : {})
				},
				resultMap: (warehouse: IWarehouse) => {
					return Object.assign({}, warehouse);
				},
				finalize: () => {
					if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
						this.merchants.push(...this.smartTableSource.getData());
					}
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.loading = false;
				}
			});
		} catch (error) {
			this.loading = false;
			this.toastrService.danger(error);
		}
	}

	/**
	 * GET merchants smart table source
	 */
	private async getMerchants() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	selectStore({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedMerchant = isSelected ? data : null;
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectStore({
			isSelected: false,
			data: null
		});
	}
}
