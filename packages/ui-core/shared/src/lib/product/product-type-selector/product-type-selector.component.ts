import { Component, OnInit, OnDestroy, Input, forwardRef, EventEmitter, Output } from '@angular/core';
import {
	IOrganization,
	IProductTypeTranslatable,
	IProductTypeTranslated,
	PermissionsEnum,
	ProductTypesIconsEnum
} from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { finalize, map, Observable, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { ErrorHandlingService, ProductTypeService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-type-selector',
	templateUrl: './product-type-selector.component.html',
	styleUrls: ['./product-type-selector.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ProductTypeSelectorComponent),
			multi: true
		}
	]
})
export class ProductTypeSelectorComponent implements OnInit, OnDestroy {
	public organization: IOrganization;
	protected subject$: Subject<any> = new Subject();
	public hasEditProductType$: Observable<boolean>;
	public productTypes$: Observable<IProductTypeTranslated[]>;
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

	private _productTypeId: IProductTypeTranslated['id'];
	set productTypeId(val: IProductTypeTranslated['id']) {
		this._productTypeId = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get productTypeId(): IProductTypeTranslated['id'] {
		return this._productTypeId;
	}

	/**
	 * Getter & Setter for Product Type
	 *
	 */
	private _productType: IProductTypeTranslated;
	set productType(val: IProductTypeTranslated) {
		this._productType = val;
	}
	get productType(): IProductTypeTranslated {
		return this._productType;
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	@Output() onChanged: EventEmitter<IProductTypeTranslated> = new EventEmitter<IProductTypeTranslated>();
	@Output() onLoaded: EventEmitter<IProductTypeTranslated[]> = new EventEmitter<IProductTypeTranslated[]>();

	constructor(
		private readonly store: Store,
		private readonly errorHandler: ErrorHandlingService,
		private readonly productTypeService: ProductTypeService
	) {}

	ngOnInit(): void {
		this.hasEditProductType$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasPermission(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT))
		);
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.getProductTypes()),
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

	writeValue(value: IProductTypeTranslated['id']) {
		if (value) {
			this._productTypeId = value;
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
	addProductType = async (name: string) => {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			const languageCode = this.store.preferredLanguage;
			const description = name;
			const icons = Object.values(ProductTypesIconsEnum);

			// Added latest product category translations
			const translations = [
				{
					name,
					description,
					languageCode,
					tenantId,
					organizationId
				}
			];
			const payload: IProductTypeTranslatable = {
				organizationId,
				tenantId,
				translations,
				icon: icons[Math.floor(Math.random() * icons.length)]
			};
			return await this.productTypeService.create(payload).finally(() => {
				this.loading = false;
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	/**
	 * GET product types
	 *
	 * @returns
	 */
	async getProductTypes() {
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			this.productTypes$ = this.productTypeService
				.getAllTranslated({
					organizationId,
					tenantId
				})
				.pipe(
					tap(({ items = [] }) => this.onLoaded.emit(items)),
					map(({ items }) => items),
					finalize(() => (this.loading = false)),
					untilDestroyed(this)
				);
		} catch (error) {
			console.log('Error while retrieving product types', error);
		}
	}

	/**
	 * On Change Product Type
	 *
	 * @param productType
	 */
	selectProductType(productType: IProductTypeTranslated): void {
		this.productTypeId = productType ? productType.id : null;
		this.productType = productType ? productType : null;
		this.onChanged.emit(productType);
	}

	ngOnDestroy(): void {}
}
