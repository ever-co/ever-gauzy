import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
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
import { TranslationBaseComponent } from '../../@shared/language-base';
import { ApprovalPolicyMutationComponent } from '../../@shared/approval-policy';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { ComponentEnum } from '../../@core/constants';
import { ApprovalPolicyService, Store, ToastrService } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approval-policy',
	templateUrl: './approval-policy.component.html',
	styleUrls: ['./approval-policy.component.scss']
})
export class ApprovalPolicyComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {
	
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
				tap(() => this.loading = true),
				tap(() => this.getApprovalPolicies()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
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
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items = [] } = await this.approvalPolicyService.getAll(['organization'], {
			tenantId,
			organizationId
		} as IApprovalPolicyFindInput)
		this.loading = false;
		this.approvalPolicies = items;
		this.smartTableSource.load(items);
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
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

	async save(selectedItem?: IApprovalPolicy) {
		if (selectedItem) {
			this.selectApprovalPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const dialog = this.dialogService.open(
			ApprovalPolicyMutationComponent,
			{
				context: {
					approvalPolicy: this.selectedApprovalPolicy,
					organizationId,
					tenantId
				}
			}
		);
		const requestApproval = await firstValueFrom(dialog.onClose);
		if (requestApproval) {
			this.toastrService.success(
				this.selectedApprovalPolicy?.id
					? 'TOASTR.MESSAGE.APPROVAL_POLICY_UPDATED'
					: 'TOASTR.MESSAGE.APPROVAL_POLICY_CREATED',
				{ name: requestApproval.name }
			);
		}
		this.policies$.next(true);
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
		const result = await firstValueFrom(this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose);

		if (result) {
			await this.approvalPolicyService.delete(
				this.selectedApprovalPolicy.id
			);
			const { name } = this.selectedApprovalPolicy;
			this.toastrService.success( 'TOASTR.MESSAGE.APPROVAL_POLICY_DELETED', { 
				name 
			});
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
