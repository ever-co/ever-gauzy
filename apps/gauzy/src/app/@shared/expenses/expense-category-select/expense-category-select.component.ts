import { Component, OnInit, OnDestroy, Input, forwardRef, EventEmitter, Output } from '@angular/core';
import { IExpenseCategory, IOrganization, IOrganizationExpenseCategory, IOrganizationVendor } from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ErrorHandlingService, OrganizationExpenseCategoriesService, ToastrService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-category-select',
	templateUrl: './expense-category-select.component.html',
	styleUrls: ['./expense-category-select.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ExpenseCategorySelectComponent),
			multi: true
		}
	]
})
export class ExpenseCategorySelectComponent implements OnInit, OnDestroy {
	categories: IExpenseCategory[] = [];
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

	/*
	 * Getter & Setter for dynamic enabled/disabled element
	 */
	_disabled: boolean = false;
	get disabled(): boolean {
		return this._disabled;
	}
	@Input() set disabled(value: boolean) {
		this._disabled = value;
	}

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	_placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for dynamic clearable option
	 */
	_clearable: boolean;
	get clearable(): boolean {
		return this._clearable;
	}
	@Input() set clearable(value: boolean) {
		this._clearable = value;
	}

	/*
	 * Getter & Setter for dynamic add tag option
	 */
	_addTag: boolean = false;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	/*
	 * Getter & Setter for dynamic searchable option
	 */
	_searchable: boolean = true;
	get searchable(): boolean {
		return this._searchable;
	}
	@Input() set searchable(value: boolean) {
		this._searchable = value;
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	private _category: IExpenseCategory;
	set category(val: IExpenseCategory) {
		this._category = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get category(): IExpenseCategory {
		return this._category;
	}

	@Output()
	onChanged = new EventEmitter<IOrganizationVendor>();

	constructor(
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly expenseCategoriesService: OrganizationExpenseCategoriesService
	) {}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.getCategories()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getCategories() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await this.expenseCategoriesService.getAll({
			organizationId,
			tenantId
		});
		this.categories = items;
	}

	writeValue(value: IOrganizationVendor) {
		this._category = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	selectCategory(category: IExpenseCategory): void {
		this.category = category;
		this.onChanged.emit(category);
	}

	addCategory = async (name: string): Promise<IOrganizationExpenseCategory> => {
		try {
			this.toastrService.success('EXPENSES_PAGE.ADD_EXPENSE_CATEGORY', {
				name
			});
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			return await this.expenseCategoriesService.create({
				name,
				organizationId,
				tenantId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	ngOnDestroy() {}
}
