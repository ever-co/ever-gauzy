import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { Validators, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { IIncome, ITag, IOrganization, ICurrency, ISelectedEmployee } from '@gauzy/contracts';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange, isNotEmpty, Store } from '@gauzy/ui-core/common';
import { OrganizationSettingService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { FormHelpers } from '../../forms/helpers';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-income-mutation',
	templateUrl: './income-mutation.component.html',
	styleUrls: ['./income-mutation.component.scss']
})
export class IncomeMutationComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	FormHelpers: typeof FormHelpers = FormHelpers;
	public organization: IOrganization;

	/*
	 * Getter & Setter
	 */
	_income: IIncome;
	get income(): IIncome {
		return this._income;
	}
	@Input() set income(value: IIncome) {
		this._income = value;
	}

	/*
	 * Income Mutation Form
	 */
	public form: UntypedFormGroup = IncomeMutationComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: IncomeMutationComponent): UntypedFormGroup {
		return fb.group({
			valueDate: [self.organizationSettingService.getDateFromOrganizationSettings(), Validators.required],
			amount: ['', Validators.required],
			organizationContact: [null, Validators.required],
			notes: [],
			currency: [],
			isBonus: [false],
			tags: [],
			employee: []
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		protected readonly dialogRef: NbDialogRef<IncomeMutationComponent>,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly organizationSettingService: OrganizationSettingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._initializeForm()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {}

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
			const { valueDate, amount, client, notes, currency, isBonus = false, tags, employee } = this.income;
			this.form.patchValue({
				valueDate: new Date(valueDate),
				amount: amount,
				organizationContact: client,
				notes: notes,
				currency: currency,
				isBonus: isBonus,
				tags: tags,
				employee: employee
			});
		}
	}

	selectedTagsHandler(tags: ITag[]) {
		if (isNotEmpty(tags)) {
			this.form.patchValue({ tags: tags });
			this.form.updateValueAndValidity();
		}
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
