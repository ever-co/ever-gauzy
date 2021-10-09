import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IEmployeeProposalTemplate, IOrganization, ISelectedEmployee } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { distinctUntilChange } from '@gauzy/common-angular';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { AvatarComponent } from './../../../../@shared/components/avatar/avatar.component';
import { TranslationBaseComponent } from './../../../../@shared/language-base/translation-base.component';
import {
	Nl2BrPipe,
	TruncatePipe
} from './../../../../@shared/pipes';
import { AddEditProposalTemplateComponent } from '../add-edit-proposal-template/add-edit-proposal-template.component';
import { Store, ToastrService } from './../../../../@core/services';
import { ProposalTemplateService } from '../proposal-template.service';
import { API_PREFIX } from './../../../../@core/constants';
import { ServerDataSource } from './../../../../@core/utils/smart-table/server.data-source';
import { HttpClient } from '@angular/common/http';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposal-template',
	templateUrl: './proposal-template.component.html',
	styleUrls: ['./proposal-template.component.scss']
})
export class ProposalTemplateComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	smartTableSettings: object;
	disableButton = true;
	smartTableSource: ServerDataSource;
	selectedEmployee: ISelectedEmployee;
	subject$: Subject<any> = new Subject();
	selectedItem: any;
	loading: boolean;
	organization: IOrganization;

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
		public translateService: TranslateService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly proposalTemplateService: ProposalTemplateService,
		private readonly dialogService: NbDialogService,
		private readonly nl2BrPipe: Nl2BrPipe,
		private readonly truncatePipe: TruncatePipe,
		private readonly httpClient: HttpClient,
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.subject$
			.pipe(
				tap(() => this.loading = true),
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getProposalTemplates()),
				untilDestroyed(this), 
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(500),
				filter(([organization]) => !!organization),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(([organization, employee]) => {
					if (organization) {
						this.selectedEmployee = (employee && employee.id) ? employee : null;
						this.subject$.next(true);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const { employeeId } = this.store.user;
		if (employeeId) {
			delete this.smartTableSettings['columns']['employeeId'];
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
	}

	/*
	* Register Smart Table Source Config 
	*/
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.selectedEmployee) {
			request['employeeId'] = this.selectedEmployee.id;
		}
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/employee-proposal-template/pagination`,
			relations: [
				'employee', 
				'employee.user'
			],
			where: {
				...{ organizationId, tenantId },
				...request,
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	getProposalTemplates() {
		try { 
			this.setSmartTableSource();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	selectItem({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedItem = isSelected ? data : null;
	}

	_loadSmartTableSettings() {
		this.smartTableSettings = {
			editable: false,
			actions: false,
			hideSubHeader: true,
			columns: {
				employeeId: {
					title: this.getTranslation(
						'PROPOSAL_TEMPLATE.EMPLOYEE'
					),
					filter: false,
					width: '20%',
					type: 'custom',
					sort: false,
					renderComponent: AvatarComponent,
					valuePrepareFunction: (
						cell,
						row: IEmployeeProposalTemplate
					) => {
						return {
							name: row.employee && row.employee.user ? row.employee.fullName : null,
							src: row.employee && row.employee.user ? row.employee.user.imageUrl : null
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

	createProposal(): void {
		this.dialogService
			.open(AddEditProposalTemplateComponent, {
				context: {
					selectedEmployee: this.selectedEmployee
				}
			})
			.onClose
			.pipe(
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	editProposal(): void {
		this.dialogService
			.open(AddEditProposalTemplateComponent, {
				context: {
					proposalTemplate: this.selectedItem,
					selectedEmployee: this.selectedEmployee
				}
			})
			.onClose
			.pipe(
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	deleteProposal(): void {
		this.proposalTemplateService.delete(this.selectedItem.id)
			.then(() => {
				this.toastrService.success('PROPOSAL_TEMPLATE.PROPOSAL_DELETE_MESSAGE', {
					name: this.selectedItem.name
				});
			}).finally(() => {
				this.subject$.next(true);
			});
	}

	makeDefault(): void {
		this.proposalTemplateService
			.makeDefault(this.selectedItem.id)
			.then(() => {
				this.toastrService.success('PROPOSAL_TEMPLATE.PROPOSAL_MAKE_DEFAULT_MESSAGE', { 
					name: this.selectedItem.name 
				});
			})
			.finally(() => {
				this.subject$.next(true);
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

	ngOnDestroy(): void {}
}
