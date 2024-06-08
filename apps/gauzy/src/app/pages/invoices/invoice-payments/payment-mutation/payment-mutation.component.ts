import { AfterViewInit, Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import {
	IInvoice,
	IPayment,
	PaymentMethodEnum,
	IOrganization,
	IOrganizationContact,
	IOrganizationProject,
	ITag,
	ICurrency
} from '@gauzy/contracts';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import moment from 'moment';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { environment } from '@gauzy/ui-config';
import { Store, compareDate, isNotEmpty } from '@gauzy/ui-sdk/common';
import { InvoicesService, OrganizationSettingService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-add',
	templateUrl: './payment-mutation.component.html',
	styleUrls: ['./payment-mutation.component.scss']
})
export class PaymentMutationComponent extends TranslationBaseComponent implements OnInit, AfterViewInit {
	invoice: IInvoice;
	invoices: IInvoice[] = [];
	public organization: IOrganization;
	payment: IPayment;
	paymentMethods = Object.values(PaymentMethodEnum);
	currencyString: string;

	get currency() {
		return this.form.get('currency');
	}

	/*
	 * Payment Mutation Form
	 */
	public form: UntypedFormGroup = PaymentMutationComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: PaymentMutationComponent): UntypedFormGroup {
		return fb.group({
			amount: [null, Validators.compose([Validators.required, Validators.min(1)])],
			currency: [],
			paymentDate: [self.organizationSettingService.getDateFromOrganizationSettings(), Validators.required],
			note: [],
			paymentMethod: [null, Validators.required],
			invoice: [],
			organizationContact: [],
			organizationContactId: [],
			project: [],
			projectId: [],
			tags: []
		});
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly fb: UntypedFormBuilder,
		protected readonly dialogRef: NbDialogRef<PaymentMutationComponent>,
		private readonly store: Store,
		private readonly invoicesService: InvoicesService,
		private readonly organizationSettingService: OrganizationSettingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(({ currency }) => (this.currencyString = currency || environment.DEFAULT_CURRENCY)),
				tap(() => this.initializeForm()),
				untilDestroyed(this)
			)
			.subscribe(() => {
				if (this.currency && !this.currency.value) {
					if (this.invoice) {
						this.currency.setValue(this.invoice.currency);
					} else if (this.currencyString) {
						this.currency.setValue(this.currencyString);
					}
					this.currency.updateValueAndValidity();
				}
			});
	}

	ngAfterViewInit() {
		this.getInvoices();
	}

	/**
	 *
	 */
	async getInvoices() {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const { items = [] } = await this.invoicesService.getAll({
				organizationId,
				tenantId,
				isEstimate: 0
			});
			this.invoices = items;
		} catch (error) {
			console.log('Error while getting organization invoices', error);
		}
	}

	initializeForm() {
		if (this.payment) {
			const { amount, currency, paymentDate, note, paymentMethod, invoice, organizationContact, project, tags } =
				this.payment;
			this.form.patchValue({
				amount,
				currency,
				paymentDate: moment(paymentDate).toDate(),
				note,
				paymentMethod,
				invoice,
				organizationContact: organizationContact ? organizationContact : null,
				organizationContactId: organizationContact ? organizationContact.id : null,
				project: project ? project : null,
				projectId: project ? project.id : null,
				tags
			});
			this.form.updateValueAndValidity();
		} else {
			if (this.invoice) {
				this.form.patchValue({ invoice: this.invoice });
				if (this.invoice.toContact) {
					this.form.patchValue({ contact: this.invoice.toContact });
				}
				this.form.updateValueAndValidity();
			}
		}
	}

	async addEditPayment() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { amount, paymentDate, note, paymentMethod, organizationContact, project, tags, invoice } =
			this.form.value;

		const payment = {
			amount,
			paymentDate: moment(paymentDate).startOf('day').toDate(),
			note,
			currency: this.currency.value,
			invoiceId: invoice ? invoice.id : null,
			tenantId,
			organizationId,
			paymentMethod,
			organizationContactId: organizationContact ? organizationContact.id : null,
			projectId: project ? project.id : null,
			tags
		};
		if (isNotEmpty(this.invoice)) {
			const overdue = compareDate(paymentDate, this.invoice.dueDate);
			payment['overdue'] = overdue;
		} else if (isNotEmpty(invoice)) {
			const overdue = compareDate(paymentDate, invoice.dueDate);
			payment['overdue'] = overdue;
		}

		if (this.payment) {
			payment['id'] = this.payment.id;
		}

		this.dialogRef.close(payment);
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
		this.form.get('tags').setValue(currentTagSelection);
		this.form.get('tags').updateValueAndValidity();
	}

	selectOrganizationContact(organizationContact: IOrganizationContact) {
		this.form.get('organizationContact').setValue(organizationContact);
		this.form.get('organizationContact').updateValueAndValidity();
	}

	/**
	 * On select project
	 *
	 * @param project
	 */
	selectProject(project: IOrganizationProject) {
		this.form.get('project').setValue(project);
		this.form.get('project').updateValueAndValidity();

		this.form.get('projectId').setValue(project.id);
		this.form.get('projectId').updateValueAndValidity();
	}

	cancel() {
		this.dialogRef.close();
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
