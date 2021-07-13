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
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import {
	InvoicesService,
	OrganizationContactService,
	OrganizationProjectsService,
	Store
} from './../../../../@core/services';
import { environment as ENV } from './../../../../../environments/environment';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-add',
	templateUrl: './payment-mutation.component.html',
	styleUrls: ['./payment-mutation.component.scss']
})
export class PaymentMutationComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit {

	invoice: IInvoice;
	invoices: IInvoice[];
	organization: IOrganization;
	payment: IPayment;
	paymentMethods = Object.values(PaymentMethodEnum);
	currencyString: string;
	organizationContact: IOrganizationContact;
	organizationContacts: IOrganizationContact[];
	project: IOrganizationProject;
	projects: IOrganizationProject[];

	get currency() {
		return this.form.get('currency');
	}

	/*
	* Payment Mutation Form 
	*/
	public form: FormGroup = PaymentMutationComponent.buildForm(this.fb);
	static buildForm( fb: FormBuilder): FormGroup {
		return fb.group({
			amount: [ '', Validators.compose([ 
				Validators.required, 
				Validators.min(1)
			])],
			currency: [],
			paymentDate: [new Date(), Validators.required],
			note: [],
			paymentMethod: ['', Validators.required],
			invoice: [],
			contact: [],
			project: [],
			tags: []
		});
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly fb: FormBuilder,
		protected readonly dialogRef: NbDialogRef<PaymentMutationComponent>,
		private readonly store: Store,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly invoicesService: InvoicesService
	) {
		super(translateService);
	}
	
	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.invoicesService
			.getAll([], { organizationId, tenantId, isEstimate: false })
			.then(({ items }) => {
				this.invoices = items;
			});
		this.organizationProjectsService
			.getAll([], { organizationId, tenantId })
			.then(({ items }) => {
				this.projects = items;
			});
		this.organizationContactService
			.getAll([], { organizationId, tenantId })
			.then(({ items }) => {
				this.organizationContacts = items;
			});
	}

	initializeForm() {
		if (this.payment) {
			const { amount, currency, paymentDate, note, paymentMethod, invoice, contact, project, tags } = this.payment;
			this.form.patchValue({
				amount,
				currency,
				paymentDate: new Date(paymentDate),
				note,
				paymentMethod,
				invoice,
				contact: contact || null,
				project: project || null,
				tags
			});
		} else {
			this.form.patchValue({
				invoice: this.invoice,
				contact: this.invoice.toContact || null
			});
		}
	}

	async addEditPayment() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { amount, paymentDate, note, paymentMethod, contact, project, tags, invoice } = this.form.value;
		const payment = {
			amount,
			paymentDate,
			note,
			currency: this.currency.value,
			invoice,
			invoiceId: invoice ? invoice.id : null,
			tenantId,
			organizationId,
			recordedBy: this.store.user,
			userId: this.store.userId,
			paymentMethod,
			contact,
			contactId: contact ? contact.id : null,
			project,
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
		this.form.patchValue({
			tags: currentTagSelection
		});
	}

	searchOrganizationContact(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	selectOrganizationContact($event: IOrganizationContact) {
		this.organizationContact = $event;
	}

	selectProject($event: IOrganizationProject) {
		this.project = $event;
	}

	cancel() {
		this.dialogRef.close();
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
