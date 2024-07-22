import { Component, OnInit, OnDestroy, Input, forwardRef, EventEmitter, Output } from '@angular/core';
import {
	IOrganization,
	IProductCategoryTranslatable,
	IProductCategoryTranslated,
	PermissionsEnum
} from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { finalize, map, Observable, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { ProductCategoryService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-category-selector',
	templateUrl: './product-category-selector.component.html',
	styleUrls: ['./product-category-selector.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ProductCategorySelectorComponent),
			multi: true
		}
	]
})
export class ProductCategorySelectorComponent implements OnInit, OnDestroy {
	public organization: IOrganization;
	protected subject$: Subject<any> = new Subject();
	public hasEditProductCategory$: Observable<boolean>;
	public productCategories$: Observable<IProductCategoryTranslated[]>;
	public loading: boolean = false;

	/*
	 * Getter & Setter for dynamic enabled/disabled element
	 */
	private _disabled: boolean = false;
	get disabled(): boolean {
		return this._disabled;
	}
	@Input() set disabled(value: boolean) {
		this._disabled = value;
	}

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	private _placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for dynamic add tag option
	 */
	private _addTag: boolean = false;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	private _productCategoryId: IProductCategoryTranslated['id'];
	set productCategoryId(val: IProductCategoryTranslated['id']) {
		this._productCategoryId = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get productCategoryId(): IProductCategoryTranslated['id'] {
		return this._productCategoryId;
	}

	/**
	 * Getter & Setter for Product Type
	 *
	 */
	private _productCategory: IProductCategoryTranslated;
	set productCategory(val: IProductCategoryTranslated) {
		this._productCategory = val;
	}
	get productCategory(): IProductCategoryTranslated {
		return this._productCategory;
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	@Output() onChanged: EventEmitter<IProductCategoryTranslated> = new EventEmitter<IProductCategoryTranslated>();
	@Output() onLoaded: EventEmitter<IProductCategoryTranslated[]> = new EventEmitter<IProductCategoryTranslated[]>();

	constructor(private readonly store: Store, private readonly productCategoryService: ProductCategoryService) {}

	ngOnInit(): void {
		this.hasEditProductCategory$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasPermission(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT))
		);
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.getProductCategories()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	writeValue(value: IProductCategoryTranslated['id']) {
		if (value) {
			this._productCategoryId = value;
		}
	}

	/**
	 * Register a listener for change events.
	 */
	registerOnChange(fn: () => void): void {
		this.onChange = fn;
	}

	/**
	 * Register a listener for touched events.
	 */
	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	/**
	 * Set disabled state for DOM element
	 *
	 * @param isDisabled
	 */
	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	/**
	 * Add product type using add tag
	 *
	 * @param name
	 * @returns
	 */
	addProductCategory = async (name: string) => {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			const languageCode = this.store.preferredLanguage;

			// Added latest product category translations
			const translations = [
				{
					name,
					tenantId,
					organizationId,
					languageCode
				}
			];
			const payload: IProductCategoryTranslatable = {
				organizationId,
				tenantId,
				translations
			};
			return await this.productCategoryService.create(payload).finally(() => {
				this.loading = false;
			});
		} catch (error) {
			console.log('Error while creating product category', error);
		}
	};

	/**
	 * GET product categories
	 *
	 * @returns
	 */
	async getProductCategories() {
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			this.productCategories$ = this.productCategoryService
				.getAllTranslated({
					organizationId,
					tenantId
				})
				.pipe(
					map(({ items = [] }) => items),
					tap((items) => this.onLoaded.emit(items)),
					finalize(() => (this.loading = false)),
					untilDestroyed(this)
				);
		} catch (error) {
			console.log('Error while retrieving product categories', error);
		}
	}

	/**
	 * On Change Product Type
	 *
	 * @param productCategory
	 */
	selectProductCategory(productCategory: IProductCategoryTranslated): void {
		this.productCategoryId = productCategory ? productCategory.id : null;
		this.productCategory = productCategory ? productCategory : null;
		this.onChanged.emit(productCategory);
	}

	ngOnDestroy(): void {}
}
