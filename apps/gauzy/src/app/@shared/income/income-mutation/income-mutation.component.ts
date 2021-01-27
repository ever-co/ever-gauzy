import { Component, OnInit, ViewChild } from '@angular/core';
import {
	Validators,
	FormBuilder,
	FormGroup,
	AbstractControl
} from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import {
	IIncome,
	ITag,
	IOrganizationContact,
	ContactType,
	IOrganization,
	ICurrency
} from '@gauzy/contracts';
import { Store } from '../../../@core/services/store.service';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { debounceTime, filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../../@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-income-mutation',
	templateUrl: './income-mutation.component.html',
	styleUrls: ['./income-mutation.component.scss']
})
export class IncomeMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;

	income?: IIncome;

	form: FormGroup;
	notes: AbstractControl;

	organizationContact: IOrganizationContact;
	organizationContacts: Object[] = [];
	tags: ITag[] = [];

	averageIncome = 0;
	averageBonus = 0;
	selectedOrganization: IOrganization;

	get valueDate() {
		return this.form.get('valueDate').value;
	}

	set valueDate(value) {
		this.form.get('valueDate').setValue(value);
	}

	get amount() {
		return this.form.get('amount').value;
	}

	set amount(value) {
		this.form.get('amount').setValue(value);
	}

	get currency() {
		return this.form.get('currency');
	}

	get clientName() {
		return this.form.get('organizationContact').value.clientName;
	}

	get clientId() {
		return this.form.get('organizationContact').value.clientId;
	}

	get isBonus() {
		return this.form.get('isBonus').value.isBonus;
	}

	constructor(
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<IncomeMutationComponent>,
		private store: Store,
		private organizationContactService: OrganizationContactService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				this.selectedOrganization = organization;
				this._initializeForm();
				this._getOrganizationContacts();
			});
	}

	private async _getOrganizationContacts() {
		this.selectedOrganization = this.store.selectedOrganization;
		const { tenantId } = this.store.user;

		const { items } = await this.organizationContactService.getAll([], {
			organizationId: this.selectedOrganization.id,
			tenantId
		});

		items.forEach((i) => {
			this.organizationContacts = [
				...this.organizationContacts,
				{ name: i.name, clientId: i.id }
			];
		});
	}

	selectOrganizationContact($event) {
		this.organizationContact = $event;
	}

	async addOrEditIncome() {
		if (this.form.valid) {
			this.dialogRef.close(
				Object.assign(
					{
						employee: this.employeeSelector.selectedEmployee
					},
					this.form.value
				)
			);
		}
	}
	addNewOrganizationContact = (
		name: string
	): Promise<IOrganizationContact> => {
		try {
			return this.organizationContactService
				.create({
					name,
					contactType: ContactType.CLIENT,
					organizationId: this.selectedOrganization.id,
					tenantId: this.selectedOrganization.id
				})
				.then((contact) => {
					this.toastrService.success(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT',
						{
							name
						}
					);
					return contact;
				});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	close() {
		this.dialogRef.close();
	}

	private _initializeForm() {
		if (this.income) {
			this.form = this.fb.group({
				valueDate: [
					new Date(this.income.valueDate),
					Validators.required
				],
				amount: [this.income.amount, Validators.required],
				organizationContact: [
					this.income.clientName,
					Validators.required
				],
				notes: this.income.notes,
				currency: this.income.currency,
				isBonus: this.income.isBonus,
				tags: [this.income.tags]
			});
		} else {
			this.form = this.fb.group({
				valueDate: [
					this.store.getDateFromOrganizationSettings(),
					Validators.required
				],
				amount: ['', Validators.required],
				organizationContact: [null, Validators.required],
				notes: [],
				currency: [],
				isBonus: false,
				tags: []
			});
			this._loadDefaultCurrency();
		}
		this.notes = this.form.get('notes');
		this.tags = this.form.get('tags').value || [];
	}

	private async _loadDefaultCurrency() {
		const orgData = this.selectedOrganization;
		if (orgData && this.currency && !this.currency.value) {
			this.currency.setValue(orgData.currency);
			this.currency.updateValueAndValidity();
		}
	}

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
