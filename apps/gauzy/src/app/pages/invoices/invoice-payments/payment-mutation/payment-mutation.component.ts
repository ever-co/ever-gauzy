import { AfterViewInit, Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { compareDate, isNotEmpty } from '@gauzy/common-angular';
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
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import * as moment from 'moment';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { InvoicesService, Store } from './../../../../@core/services';
import { environment as ENV } from './../../../../../environments/environment';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-add',
	templateUrl: './payment-mutation.component.html',
	styleUrls: ['./payment-mutation.component.scss']
})
export class PaymentMutationComponent extends TranslationBaseComponent
	implements OnInit, AfterViewInit {

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
	public form: FormGroup = PaymentMutationComponent.buildForm(this.fb, this);
	static buildForm(
		fb: FormBuilder,
		self: PaymentMutationComponent
	): FormGroup {
		return fb.group({
			amount: ['', Validators.compose([
				Validators.required,
				Validators.min(1)
			])],
			currency: [],
			paymentDate: [self.store.getDateFromOrganizationSettings(), Validators.required],
			note: [],
			paymentMethod: ['', Validators.required],
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
		private readonly fb: FormBuilder,
		protected readonly dialogRef: NbDialogRef<PaymentMutationComponent>,
		private readonly store: Store,
		private readonly invoicesService: InvoicesService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(({ currency }) => this.currencyString = currency || ENV.DEFAULT_CURRENCY),
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
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.invoicesService
			.getAll({ organizationId, tenantId, isEstimate: false })
			.then(({ items }) => {
				this.invoices = items;
			});
	}

	initializeForm() {
		if (this.payment) {
			const { amount, currency, paymentDate, note, paymentMethod, invoice, organizationContact, project, tags } = this.payment;
			this.form.patchValue({
				amount,
				currency,
				paymentDate: new Date(paymentDate),
				note,
				paymentMethod,
				invoice,
				organizationContact: (organizationContact) ? organizationContact : null,
				organizationContactId: (organizationContact) ? organizationContact.id : null,
				project: (project) ? project : null,
				projectId: (project) ? project.id : null,
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
		const { amount, paymentDate, note, paymentMethod, organizationContact, project, tags, invoice } = this.form.value;
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

	selectProject(organizationProject: IOrganizationProject) {
		this.form.get('project').setValue(organizationProject);
		this.form.get('project').updateValueAndValidity();
	}

	cancel() {
		this.dialogRef.close();
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
