import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogService, NbTabComponent } from '@nebular/theme';
import { combineLatest, Subject, firstValueFrom, BehaviorSubject, merge } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { NgxPermissionsService } from 'ngx-permissions';
import {
	IEmployee,
	IEmployeeProposalTemplate,
	IEmployeeProposalTemplateMakeDefaultInput,
	IOrganization,
	ISelectedEmployee,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	ProposalTemplateService,
	ServerDataSource,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';
import {
	DeleteConfirmationComponent,
	EmployeeLinksComponent,
	IPaginationBase,
	Nl2BrPipe,
	PaginationFilterBaseComponent,
	TruncatePipe
} from '@gauzy/ui-core/shared';
import { ProposalTemplateFormComponent } from '../proposal-template-form/proposal-template-form.component';

export enum ProposalTemplateTabsEnum {
	ACTIONS = 'ACTIONS',
	SEARCH = 'SEARCH'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposal-template-list',
	templateUrl: './proposal-template-list.component.html',
	styleUrls: ['./proposal-template-list.component.scss'],
	standalone: false
})
export class ProposalTemplateListComponent
	extends PaginationFilterBaseComponent
	implements OnInit, AfterViewInit, OnDestroy
{
	public smartTableSettings: any;
	public disableButton: boolean = true;
	public loading: boolean = false;
	public smartTableSource: ServerDataSource;
	public selectedEmployee: ISelectedEmployee;
	public selectedItem: any;
	public proposalTemplateTabsEnum = ProposalTemplateTabsEnum;
	public templates$: Subject<any> = new Subject();
	public organization: IOrganization;
	public nbTab$: Subject<string> = new BehaviorSubject(ProposalTemplateTabsEnum.ACTIONS);

	/** Typed as any to avoid TemplateRef type mismatch across plugin vs workspace @angular/core. */
	@ViewChild('actionButtons', { static: true }) readonly actionButtons!: any;
	/** Typed as any to avoid TemplateRef type mismatch across plugin vs workspace @angular/core. */
	@ViewChild('visibleButton', { static: true }) readonly visibleButton!: any;

	constructor(
		translateService: TranslateService,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		private readonly _proposalTemplateService: ProposalTemplateService,
		private readonly _dialogService: NbDialogService,
		private readonly _nl2BrPipe: Nl2BrPipe,
		private readonly _truncatePipe: TruncatePipe,
		private readonly _http: HttpClient,
		private readonly _route: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _ngxPermissionsService: NgxPermissionsService,
		private readonly _i18nService: I18nService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Apply translation on smart table
		this._applyTranslationOnSmartTable();
		// Load smart table settings
		this._loadSmartTableSettings();
		// Initialize UI permissions
		this.initializeUiPermissions();
		// Initialize UI languages and Update Locale
		this.initializeUiLanguagesAndLocale();

		// Subscribe to changes in the templates$ observable stream
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
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;
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
		this._route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.createProposalTemplate()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		if (this._store.user && !this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			delete this.smartTableSettings['columns']['employeeId'];
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
	}

	private initializeUiPermissions() {
		const permissions = this._store.userRolePermissions.map(({ permission }) => permission);
		this._ngxPermissionsService.flushPermissions();
		this._ngxPermissionsService.loadPermissions(permissions);
	}

	private initializeUiLanguagesAndLocale() {
		const preferredLanguage$ = merge(this._store.preferredLanguage$, this._i18nService.preferredLanguage$).pipe(
			distinctUntilChange(),
			filter((lang: string | LanguagesEnum) => !!lang),
			tap((lang: string | LanguagesEnum) => {
				this.translateService.use(lang);
			}),
			untilDestroyed(this)
		);
		preferredLanguage$.subscribe();
	}

	setSmartTableSource() {
		if (!this.organization) return;

		this.loading = true;
		const { id: organizationId, tenantId } = this.organization;

		this.smartTableSource = new ServerDataSource(this._http, {
			endPoint: `${API_PREFIX}/employee-proposal-template/pagination`,
			relations: ['employee', 'employee.user'],
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployee ? { employeeId: this.selectedEmployee.id } : {}),
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

	async getProposalTemplates(): Promise<void> {
		if (!this.organization) return;

		try {
			this.setSmartTableSource();
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			console.log('Error while retrieving proposal templates', error);
			this._errorHandlingService.handleError(error);
		}
	}

	selectProposalTemplate({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedItem = isSelected ? data : null;
	}

	private _loadSmartTableSettings(): void {
		const pagination: IPaginationBase = this.getPagination();

		this.smartTableSettings = {
			actions: false,
			editable: true,
			hideSubHeader: true,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PROPOSAL_TEMPLATE'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				employee: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.EMPLOYEE'),
					isFilterable: false,
					width: '20%',
					type: 'custom',
					isSortable: false,
					renderComponent: EmployeeLinksComponent,
					valuePrepareFunction: (value: IEmployee) => ({
						id: value?.id,
						name: value?.user?.name,
						fullName: value?.fullName,
						imageUrl: value?.user?.imageUrl
					}),
					componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				name: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.NAME'),
					type: 'text',
					width: '30%',
					isFilterable: false,
					isSortable: false,
					valuePrepareFunction: (value: string) => value.slice(0, 150)
				},
				content: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.DESCRIPTION'),
					type: 'html',
					width: '40%',
					isFilterable: false,
					isSortable: false,
					valuePrepareFunction: (value: string) => {
						return value ? this._truncatePipe.transform(this._nl2BrPipe.transform(value), 500) : '';
					}
				},
				isDefault: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.IS_DEFAULT'),
					type: 'text',
					width: '10%',
					isFilterable: false,
					isSortable: false,
					valuePrepareFunction: (value: boolean) => {
						return value
							? this.getTranslation('PROPOSAL_TEMPLATE.YES')
							: this.getTranslation('PROPOSAL_TEMPLATE.NO');
					}
				}
			}
		};
	}

	async createProposalTemplate(): Promise<void> {
		const dialog = this._dialogService.open(ProposalTemplateFormComponent, {
			context: { selectedEmployee: this.selectedEmployee }
		});

		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.templates$.next(true);
		}
	}

	async editProposalTemplate(): Promise<void> {
		const dialog = this._dialogService.open(ProposalTemplateFormComponent, {
			context: {
				proposalTemplate: this.selectedItem,
				selectedEmployee: this.selectedEmployee
			}
		});

		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.templates$.next(true);
		}
	}

	deleteProposalTemplate(selectedItem?: IEmployeeProposalTemplate): void {
		if (selectedItem) {
			this.selectProposalTemplate({
				isSelected: true,
				data: selectedItem
			});
		}

		const dialogRef = this._dialogService.open(DeleteConfirmationComponent, {
			context: { recordType: 'Proposal' }
		});

		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				if (dialogResult) {
					if (!this.selectedItem) return;

					const { id: proposalTemplateId, name } = this.selectedItem;
					await this._proposalTemplateService.delete(proposalTemplateId);
					this._toastrService.success('PROPOSAL_TEMPLATE.PROPOSAL_DELETE_MESSAGE', { name });
				}
			} catch (error) {
				this._errorHandlingService.handleError(error);
			} finally {
				this.templates$.next(true);
			}
		});
	}

	async makeDefaultTemplate(input: IEmployeeProposalTemplateMakeDefaultInput): Promise<void> {
		try {
			if (!this.selectedItem) return;

			const { id: proposalTemplateId, organizationId, tenantId } = this.selectedItem;
			const result = await this._proposalTemplateService.makeDefault(proposalTemplateId, {
				isDefault: input.isDefault,
				organizationId,
				tenantId
			});

			const successMessage = result.isDefault
				? 'PROPOSAL_TEMPLATE.PROPOSAL_MAKE_DEFAULT_MESSAGE'
				: 'PROPOSAL_TEMPLATE.PROPOSAL_REMOVE_DEFAULT_MESSAGE';

			this._toastrService.success(successMessage, { name: this.selectedItem.name });
		} catch (error) {
			this._errorHandlingService.handleError(error);
		} finally {
			this.templates$.next(true);
		}
	}

	clearItem() {
		this.selectProposalTemplate({ isSelected: false, data: null });
	}

	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onTabChange(tab: NbTabComponent): void {
		this.nbTab$.next(tab.tabId);
	}

	ngOnDestroy(): void {}
}
