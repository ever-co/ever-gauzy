import { Component, OnInit, ViewChild } from '@angular/core';
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
	ICurrency
} from '@gauzy/contracts';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';


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
	* Search Tab Form 
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
			tags: []
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
		this.dialogRef.close(
			Object.assign(
				{ employee: this.employeeSelector.selectedEmployee },
				this.form.value
			)
		);
	}
	
	close() {
		this.dialogRef.close();
	}

	private _initializeForm() {
		if (this.income) {
			const { valueDate, amount, client, notes, currency, isBonus, tags } = this.income;
			this.form.patchValue({
				valueDate: new Date(valueDate),
				amount: amount,
				organizationContact: client,
				notes: notes,
				currency: currency,
				isBonus: isBonus,
				tags: tags
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
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return (
			(this.form.get(control).touched || this.form.get(control).dirty) && 
			this.form.get(control).invalid
		);
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
