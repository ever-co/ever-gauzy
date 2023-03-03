import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
	IEmployeeProposalTemplate,
	IOrganization,
	ISelectedEmployee,
	PermissionsEnum
} from '@gauzy/contracts';
import { NbDialogService, NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { distinctUntilChange } from '@gauzy/common-angular';
import { combineLatest, Subject, firstValueFrom, BehaviorSubject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Nl2BrPipe, TruncatePipe } from './../../../../@shared/pipes';
import { AddEditProposalTemplateComponent } from '../add-edit-proposal-template/add-edit-proposal-template.component';
import { Store, ToastrService } from './../../../../@core/services';
import { ProposalTemplateService } from '../proposal-template.service';
import { API_PREFIX } from './../../../../@core/constants';
import { ServerDataSource } from './../../../../@core/utils/smart-table/server.data-source';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../../../@shared/pagination/pagination-filter-base.component';
import { EmployeeLinksComponent } from './../../../../@shared/table-components';

export enum ProposalTemplateTabsEnum {
	ACTIONS = 'ACTIONS',
	SEARCH = 'SEARCH'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposal-template',
	templateUrl: './proposal-template.component.html',
	styleUrls: ['./proposal-template.component.scss']
})
export class ProposalTemplateComponent extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {

	smartTableSettings: object;
	disableButton: boolean = true;
	loading: boolean = false;
	smartTableSource: ServerDataSource;
	selectedEmployee: ISelectedEmployee;
	selectedItem: any;
	isDefault: boolean = false;

	proposalTemplateTabsEnum = ProposalTemplateTabsEnum;
	templates$: Subject<any> = new Subject();
	public organization: IOrganization;
	nbTab$: Subject<string> = new BehaviorSubject(ProposalTemplateTabsEnum.ACTIONS);

	proposalTemplateTable: Ng2SmartTableComponent;
	@ViewChild('proposalTemplateTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.proposalTemplateTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly proposalTemplateService: ProposalTemplateService,
		private readonly dialogService: NbDialogService,
		private readonly nl2BrPipe: Nl2BrPipe,
		private readonly truncatePipe: TruncatePipe,
		private readonly http: HttpClient,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.templates$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.getProposalTemplates()),
				untilDestroyed(this)
			)
			.subscribe();
		this.nbTab$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.templates$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.templates$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee && employee.id ? employee : null;
				}),
				tap(() => this.refreshPagination()),
				tap(() => this.templates$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.createProposalTemplate()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		if (this.store.user && !this.store.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		)) {
			delete this.smartTableSettings['columns']['employeeId'];
			this.smartTableSettings = Object.assign(
				{},
				this.smartTableSettings
			);
		}
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/employee-proposal-template/pagination`,
			relations: ['employee', 'employee.user'],
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployee
					? {
							employeeId: this.selectedEmployee.id
					  }
					: {}),
				...(this.filters.where ? this.filters.where : {})
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	async getProposalTemplates() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(
				activePage,
				itemsPerPage,
				false
			);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	selectItem({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedItem = isSelected ? data : null;
		this.isDefault = this.selectedItem?.isDefault;
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			editable: true,
			hideSubHeader: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PROPOSAL_TEMPLATE'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				employeeId: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.EMPLOYEE'),
					filter: false,
					width: '20%',
					type: 'custom',
					sort: false,
					renderComponent: EmployeeLinksComponent,
					valuePrepareFunction: (
						cell,
						row: IEmployeeProposalTemplate
					) => {
						return {
							id: row?.employee ? row?.employee.id : null,
							name: row?.employee?.user ? row.employee?.user?.name : null,
							imageUrl: row?.employee?.user ? row.employee?.user?.imageUrl : null,
						};
					}
				},
				name: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.NAME'),
					type: 'text',
					width: '30%',
					filter: false,
					sort: false,
					valuePrepareFunction: (
						cell,
						row: IEmployeeProposalTemplate
					) => {
						return `${row.name.slice(0, 150)}`;
					}
				},
				content: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.DESCRIPTION'),
					type: 'html',
					width: '40%',
					filter: false,
					sort: false,
					valuePrepareFunction: (
						cell,
						row: IEmployeeProposalTemplate
					) => {
						if (row.content) {
							let value = this.nl2BrPipe.transform(row.content);
							return this.truncatePipe.transform(value, 500);
						}
						return;
					}
				},
				isDefault: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.IS_DEFAULT'),
					type: 'text',
					width: '10%',
					filter: false,
					sort: false,
					valuePrepareFunction: (
						cell,
						row: IEmployeeProposalTemplate
					) => {
						return row.isDefault
							? this.getTranslation('PROPOSAL_TEMPLATE.YES')
							: this.getTranslation('PROPOSAL_TEMPLATE.NO');
					}
				}
			}
		};
	}

	async createProposalTemplate(): Promise<void> {
		const dialog = this.dialogService.open(
			AddEditProposalTemplateComponent,
			{
				context: {
					selectedEmployee: this.selectedEmployee
				}
			}
		);

		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.templates$.next(true);
		}
	}

	async editProposalTemplate(): Promise<void> {
		const dialog = this.dialogService.open(
			AddEditProposalTemplateComponent,
			{
				context: {
					proposalTemplate: this.selectedItem,
					selectedEmployee: this.selectedEmployee
				}
			}
		);

		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.templates$.next(true);
		}
	}

	deleteProposalTemplate(): void {
		this.proposalTemplateService
			.delete(this.selectedItem.id)
			.then(() => {
				this.toastrService.success(
					'PROPOSAL_TEMPLATE.PROPOSAL_DELETE_MESSAGE',
					{
						name: this.selectedItem.name
					}
				);
			})
			.finally(() => {
				this.templates$.next(true);
			});
	}

	makeDefaultTemplate(): void {
		this.proposalTemplateService
			.makeDefault(this.selectedItem.id)
			.then((data) => {
				const successMessage = data.isDefault
					? 'PROPOSAL_TEMPLATE.PROPOSAL_MAKE_DEFAULT_MESSAGE'
					: 'PROPOSAL_TEMPLATE.PROPOSAL_REMOVE_DEFAULT_MESSAGE';
				this.toastrService.success(successMessage, {
					name: this.selectedItem.name,
				});
			})
			.finally(() => {
				this.templates$.next(true);
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.proposalTemplateTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectItem({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.proposalTemplateTable && this.proposalTemplateTable.grid) {
			this.proposalTemplateTable.grid.dataSet['willSelect'] = 'false';
			this.proposalTemplateTable.grid.dataSet.deselectAll();
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onTabChange(tab: NbTabComponent) {
		this.nbTab$.next(tab.tabId);
	}

	ngOnDestroy(): void {}
}
