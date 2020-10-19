import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { OnInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { PaymentService } from '../../@core/services/payment.service';
import { Store } from '../../@core/services/store.service';
import { takeUntil, first, filter } from 'rxjs/operators';
import { Subject } from 'rxjs';
import {
	IPayment,
	ComponentLayoutStyleEnum,
	IInvoice,
	IOrganization,
	OrganizationSelectInput,
	IOrganizationContact,
	IOrganizationProject
} from '@gauzy/models';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { PaymentMutationComponent } from '../invoices/invoice-payments/payment-mutation/payment-mutation.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { InvoicesService } from '../../@core/services/invoices.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { InvoiceEstimateHistoryService } from '../../@core/services/invoice-estimate-history.service';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';

@Component({
	selector: 'ngx-payments',
	templateUrl: './payments.component.html',
	styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('invoicesTable') paymentsTable;

	constructor(
		readonly translateService: TranslateService,
		private paymentService: PaymentService,
		private store: Store,
		private organizationContactService: OrganizationContactService,
		private dialogService: NbDialogService,
		private router: Router,
		private invoicesService: InvoicesService,
		private organizationsService: OrganizationsService,
		private organizationProjectsService: OrganizationProjectsService,
		private toastrService: NbToastrService,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
		this.setView();
	}

	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedPayment: IPayment;
	payments: IPayment[];
	paymentsData: IPayment[];
	private _ngDestroy$ = new Subject<void>();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	invoices: IInvoice[];
	organization: IOrganization;
	disableButton = true;
	currency: string;
	organizationContacts: IOrganizationContact[];
	projects: IOrganizationProject[];
	loading = true;

	ngOnInit() {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.PAYMENTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	async loadSettings() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				takeUntil(this._ngDestroy$)
			)
			.subscribe(async (org) => {
				if (org) {
					this.loading = true;
					try {
						this.organization = org;
						const orgData = await this.organizationsService
							.getById(org.id, [OrganizationSelectInput.currency])
							.pipe(first())
							.toPromise();
						this.currency = orgData.currency;
						const invoices = await this.invoicesService.getAll([], {
							organizationId: org.id,
							tenantId: org.tenantId,
							isEstimate: false
						});
						this.invoices = invoices.items;
						this.selectedPayment = null;
						const { items } = await this.paymentService.getAll(
							[
								'invoice',
								'recordedBy',
								'contact',
								'project',
								'tags'
							],
							{
								organizationId: org.id,
								tenantId: org.tenantId
							}
						);
						for (const payment of items) {
							if (payment.invoice) {
								const organizationContact = await this.organizationContactService.getById(
									payment.invoice.organizationContactId
								);
								payment.invoice.toContact = organizationContact;
							}
						}
						const res = await this.organizationContactService.getAll(
							[],
							{
								organizationId: org.id,
								tenantId: org.tenantId
							}
						);

						if (res) {
							this.organizationContacts = res.items;
						}

						const projects = await this.organizationProjectsService.getAll(
							[],
							{
								organizationId: org.id,
								tenantId: org.tenantId
							}
						);
						this.projects = projects.items;
						this.smartTableSource.load(items);
						this.loading = false;
					} catch (error) {
						this._errorHandlingService.handleError(error);
					}
				}
			});
	}

	async recordPayment() {
		const result = await this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					invoices: this.invoices,
					organization: this.organization,
					currencyString: this.currency,
					organizationContacts: this.organizationContacts,
					projects: this.projects
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			result['organizationId'] = this.organization.id;
			result['tenantId'] = this.organization.tenantId;
			await this.paymentService.add(result);
			await this.loadSettings();
			if (result.invoice) {
				await this.invoiceEstimateHistoryService.add({
					action: `Payment of ${result.amount} ${result.currency} added`,
					invoice: result.invoice,
					invoiceId: result.invoice.id,
					user: this.store.user,
					userId: this.store.userId,
					organization: this.organization,
					organizationId: this.organization.id,
					tenantId: this.organization.tenantId
				});
			}
		}
	}

	async editPayment() {
		const result = await this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					invoices: this.invoices,
					organization: this.organization,
					payment: this.selectedPayment,
					organizationContacts: this.organizationContacts,
					projects: this.projects,
					tags: this.selectedPayment.tags
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.update(result.id, result);
			await this.loadSettings();
			await this.invoiceEstimateHistoryService.add({
				action: `Payment edited`,
				invoice: result.invoice,
				invoiceId: result.invoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.organization,
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId
			});
			this.clearItem();
		}
	}

	async deletePayment() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.delete(this.selectedPayment.id);
			this.loadSettings();
			await this.invoiceEstimateHistoryService.add({
				action: `Payment deleted`,
				invoice: this.selectedPayment.invoice,
				invoiceId: this.selectedPayment.invoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.organization,
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId
			});
			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.clearItem();
		}
		this.disableButton = true;
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				amount: {
					title: this.getTranslation('PAYMENTS_PAGE.AMOUNT'),
					type: 'text',
					filter: false,
					width: '9%'
				},
				paymentDate: {
					title: this.getTranslation('PAYMENTS_PAGE.PAYMENT_DATE'),
					type: 'text',
					width: '9%',
					valuePrepareFunction: (cell, row) => {
						return `${cell.slice(0, 10)}`;
					}
				},
				paymentMethod: {
					title: 'Payment Method',
					type: 'text',
					width: '9%'
				},
				currency: {
					title: 'Currency',
					type: 'text',
					width: '9%'
				},
				recordedBy: {
					title: this.getTranslation('PAYMENTS_PAGE.RECORDED_BY'),
					type: 'text',
					filter: false,
					width: '9%',
					valuePrepareFunction: (cell, row) => {
						if (cell && cell.firstName && cell.lastName) {
							return `${cell.firstName} ${cell.lastName}`;
						} else {
							return ``;
						}
					}
				},
				note: {
					title: this.getTranslation('PAYMENTS_PAGE.NOTE'),
					type: 'text',
					filter: false,
					width: '9%'
				},
				organizationContactName: {
					title: this.getTranslation('PAYMENTS_PAGE.CONTACT'),
					type: 'text',
					width: '9%',
					valuePrepareFunction: (cell, row) => {
						if (row.invoice) {
							return row.invoice.toContact.name;
						} else if (row.contact) {
							return row.contact.name;
						}
					}
				},
				projectName: {
					title: 'Project',
					type: 'text',
					width: '9%',
					valuePrepareFunction: (cell, row) => {
						if (row.project) {
							return row.project.name;
						}
					}
				},
				tags: {
					title: 'Tags',
					type: 'custom',
					width: '9%',
					renderComponent: NotesWithTagsComponent
				},
				invoiceNumber: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'text',
					filter: false,
					width: '9%',
					valuePrepareFunction: (cell, row) => {
						if (row.invoice) {
							return row.invoice.invoiceNumber;
						}
					}
				},
				overdue: {
					title: this.getTranslation('PAYMENTS_PAGE.STATUS'),
					type: 'custom',
					width: '9%',
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (cell, row) => {
						let badgeClass;
						if (cell) {
							badgeClass = 'danger';
							cell = this.getTranslation(
								'INVOICES_PAGE.PAYMENTS.OVERDUE'
							);
						} else {
							badgeClass = 'success';
							cell = this.getTranslation(
								'INVOICES_PAGE.PAYMENTS.ON_TIME'
							);
						}
						return {
							text: cell,
							class: badgeClass
						};
					}
				}
			}
		};
	}

	clearItem() {
		this.selectPayment({
			isSelected: false,
			data: null
		});
	}

	async selectPayment({ isSelected, data }) {
		const selectedPayment = isSelected ? data : null;
		if (this.paymentsTable) {
			this.paymentsTable.grid.dataSet.willSelect = false;
		}

		this.disableButton = !isSelected;
		this.selectedPayment = selectedPayment;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
