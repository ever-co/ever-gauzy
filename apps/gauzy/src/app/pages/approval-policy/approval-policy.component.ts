import {
	Component,
	OnInit,
	ViewChild,
	OnDestroy,
	AfterViewInit
} from '@angular/core';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IApprovalPolicy,
	ComponentLayoutStyleEnum,
	IApprovalPolicyFindInput,
	IOrganization
} from '@gauzy/contracts';
import { ApprovalPolicyMutationComponent } from '../../@shared/approval-policy';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { ComponentEnum } from '../../@core/constants';
import { distinctUntilChange } from '../../../../../../packages/common-angular/src/utils/shared-utils';
import {
	ApprovalPolicyService,
	Store,
	ToastrService
} from '../../@core/services';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../@shared/pagination/pagination-filter-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approval-policy',
	templateUrl: './approval-policy.component.html',
	styleUrls: ['./approval-policy.component.scss']
})
export class ApprovalPolicyComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy
{
	public settingsSmartTable: object;

	public loading: boolean;
	public disableButton = true;

	public selectedApprovalPolicy: IApprovalPolicy;
	public smartTableSource = new LocalDataSource();
	approvalPolicies: IApprovalPolicy[] = [];

	viewComponentName: ComponentEnum = ComponentEnum.APPROVAL_POLICY;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	policies$: Subject<any> = new Subject();

	approvalPolicyTable: Ng2SmartTableComponent;
	@ViewChild('approvalPolicyTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.approvalPolicyTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly approvalPolicyService: ApprovalPolicyService,
		private readonly router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngAfterViewInit() {
		this.policies$
			.pipe(
				debounceTime(300),
				tap(() => this.getApprovalPolicies()),
				tap(() => this.clearItem()),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.policies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap(
					(organization: IOrganization) =>
						(this.organization = organization)
				),
				tap(() => this.policies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				tap(() => {
					if (
						this.componentLayoutStyleEnum.CARDS_GRID ===
						this.dataLayoutStyle
					)
						this._loadGridLayoutData();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.approvalPolicyTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	async getApprovalPolicies() {
		this.loading = true;
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { activePage, itemsPerPage } = this.getPagination();
			const { items = [] } = await this.approvalPolicyService.getAll(
				['organization'],
				{ tenantId, organizationId } as IApprovalPolicyFindInput
			);
			this.approvalPolicies = items;
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			this.smartTableSource.load(items);
			if (
				this.componentLayoutStyleEnum.CARDS_GRID ===
				this.dataLayoutStyle
			)
				this._loadGridLayoutData();
		} catch (error) {
			console.log('Error while retrieving approval policies', error);
		} finally {
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});
			this.loading = false;
		}
	}

	private async _loadGridLayoutData() {
		this.approvalPolicies = await this.smartTableSource.getElements();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination : 10
			},
			columns: {
				name: {
					title: this.getTranslation(
						'APPROVAL_POLICY_PAGE.APPROVAL_POLICY_NAME'
					),
					type: 'string'
				},
				description: {
					title: this.getTranslation(
						'APPROVAL_POLICY_PAGE.APPROVAL_POLICY_DESCRIPTION'
					),
					type: 'string',
					filter: false
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

	async edit(selectedItem?: IApprovalPolicy) {
		try {
			if (selectedItem) {
				this.selectApprovalPolicy({
					isSelected: true,
					data: selectedItem
				});
			}
			const dialog = this.dialogService.open(
				ApprovalPolicyMutationComponent,
				{
					context: {
						approvalPolicy: this.selectedApprovalPolicy
					}
				}
			);
			const result: IApprovalPolicy = await firstValueFrom(
				dialog.onClose
			);
			if (result) {
				this.toastrService.success(
					'TOASTR.MESSAGE.APPROVAL_POLICY_UPDATED',
					{
						name: result.name
					}
				);
				this.policies$.next(true);
			}
		} catch (error) {
			console.log('Error while updating approval policy', error);
		}
	}

	async add() {
		try {
			const dialog = this.dialogService.open(
				ApprovalPolicyMutationComponent
			);
			const result: IApprovalPolicy = await firstValueFrom(
				dialog.onClose
			);
			if (result) {
				this.toastrService.success(
					'TOASTR.MESSAGE.APPROVAL_POLICY_CREATED',
					{
						name: result.name
					}
				);
				this.policies$.next(true);
			}
		} catch (error) {
			console.log('Error while creating approval policy', error);
		}
	}

	async selectApprovalPolicy({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedApprovalPolicy = isSelected ? data : null;
	}

	async delete(selectedItem?: IApprovalPolicy) {
		if (selectedItem) {
			this.selectApprovalPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent).onClose
		);

		if (result) {
			await this.approvalPolicyService.delete(
				this.selectedApprovalPolicy.id
			);
			const { name } = this.selectedApprovalPolicy;
			this.toastrService.success(
				'TOASTR.MESSAGE.APPROVAL_POLICY_DELETED',
				{
					name
				}
			);
		}
		this.policies$.next(true);
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectApprovalPolicy({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.approvalPolicyTable && this.approvalPolicyTable.grid) {
			this.approvalPolicyTable.grid.dataSet['willSelect'] = 'false';
			this.approvalPolicyTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
