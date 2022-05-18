import { Component, OnInit } from '@angular/core';
import {
	Validators,
	FormBuilder,
	FormGroup
} from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import {
	IIncome,
	ITag,
	IOrganizationContact,
	IOrganization,
	ICurrency,
	ISelectedEmployee
} from '@gauzy/contracts';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { FormHelpers } from '../../forms/helpers';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-income-mutation',
	templateUrl: './income-mutation.component.html',
	styleUrls: ['./income-mutation.component.scss']
})
export class IncomeMutationComponent
	extends TranslationBaseComponent
	implements OnInit {

	FormHelpers: typeof FormHelpers = FormHelpers;

	income?: IIncome;
	organizationContact: IOrganizationContact;
	organization: IOrganization;

	get valueDate() {
		return this.form.get('valueDate').value;
	}
	set valueDate(value) {
		this.form.get('valueDate').setValue(value);
	}

	get currency() {
		return this.form.get('currency');
	}

	/*
	* Income Mutation Form
	*/
	public form: FormGroup = IncomeMutationComponent.buildForm(this.fb, this);
	static buildForm(
		fb: FormBuilder,
		self: IncomeMutationComponent
	): FormGroup {
		return fb.group({
			valueDate: [ self.store.getDateFromOrganizationSettings(), Validators.required ],
			amount: ['', Validators.required],
			organizationContact: [null, Validators.required],
			notes: [],
			currency: [],
			isBonus: false,
			tags: [],
			employee: []
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		protected readonly dialogRef: NbDialogRef<IncomeMutationComponent>,
		private readonly store: Store,
		readonly translateService: TranslateService,
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._loadDefaultCurrency()),
				tap(() => this._initializeForm()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectOrganizationContact($event) {
		this.organizationContact = $event;
	}

	async addOrEditIncome() {
		if (this.form.invalid) {
			return;
		}
		this.dialogRef.close(Object.assign({}, this.form.getRawValue()));
	}
	
	close() {
		this.dialogRef.close();
	}

	private _initializeForm() {
		if (this.income) {
			const { valueDate, amount, client, notes, currency, isBonus, tags, employee } = this.income;
			this.form.patchValue({
				valueDate: new Date(valueDate),
				amount: amount,
				organizationContact: client,
				notes: notes,
				currency: currency,
				isBonus: isBonus,
				tags: tags,
				employee
			});
		}
	}

	private _loadDefaultCurrency() {
		const organization = this.organization;
		if (organization && this.currency && !this.currency.value) {
			this.currency.setValue(organization.currency);
			this.currency.updateValueAndValidity();
		}
	}

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.patchValue({
			tags: currentSelection
		});
		this.form.updateValueAndValidity();
	}

	/**
	 * Select Employee Selector
	 * 
	 * @param employee 
	 */
	selectionEmployee(employee: ISelectedEmployee) {
		if (employee) {
			this.form.patchValue({ employee: employee });
			this.form.updateValueAndValidity();
		}
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
