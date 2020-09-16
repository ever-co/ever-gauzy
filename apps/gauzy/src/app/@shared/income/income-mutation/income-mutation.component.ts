import { Component, OnInit, ViewChild } from '@angular/core';
import {
	Validators,
	FormBuilder,
	FormGroup,
	AbstractControl
} from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import {
	IIncome,
	OrganizationSelectInput,
	ITag,
	IOrganizationContact,
	ContactType
} from '@gauzy/models';
import { CurrenciesEnum } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ngx-income-mutation',
	templateUrl: './income-mutation.component.html',
	styleUrls: ['./income-mutation.component.scss']
})
export class IncomeMutationComponent extends TranslationBaseComponent
	implements OnInit {
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;

	income?: IIncome;
	currencies = Object.values(CurrenciesEnum);

	form: FormGroup;
	notes: AbstractControl;

	organizationId: string;
	organizationContact: IOrganizationContact;
	organizationContacts: Object[] = [];
	tags: ITag[] = [];

	averageIncome = 0;
	averageBonus = 0;

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
		private organizationsService: OrganizationsService,
		private store: Store,
		private organizationContactService: OrganizationContactService,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this.form.get('currency').disable();
		this._getOrganizationContacts();
	}

	private async _getOrganizationContacts() {
		this.organizationId = this.store.selectedOrganization.id;
		const { items } = await this.organizationContactService.getAll([], {
			organizationId: this.store.selectedOrganization.id
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
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			return this.organizationContactService.create({
				name,
				contactType: ContactType.CLIENT,
				organizationId: this.organizationId
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
				notes: '',
				currency: '',
				isBonus: false,
				tags: []
			});

			this._loadDefaultCurrency();
		}
		this.notes = this.form.get('notes');
		this.tags = this.form.get('tags').value || [];
	}

	private async _loadDefaultCurrency() {
		const orgData = await this.organizationsService
			.getById(this.store.selectedOrganization.id, [
				OrganizationSelectInput.currency
			])
			.pipe(first())
			.toPromise();

		if (orgData && this.currency && !this.currency.value) {
			this.currency.setValue(orgData.currency);
		}
	}
	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}
}
