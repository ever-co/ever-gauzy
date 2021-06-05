import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	forwardRef,
	EventEmitter,
	Output} from '@angular/core';
import {
	IOrganization,
	IOrganizationVendor
} from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../@core/services/store.service';
import { ErrorHandlingService, OrganizationVendorsService, ToastrService } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-vendor-select',
	templateUrl: './vendor-select.component.html',
	styleUrls: ['./vendor-select.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => VendorSelectComponent),
			multi: true
		}
	]
})
export class VendorSelectComponent implements OnInit, OnDestroy {

	vendors: IOrganizationVendor[] = [];
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
	_searchable: boolean = false;
	get searchable(): boolean {
		return this._searchable;
	}
	@Input() set searchable(value: boolean) {
		this._searchable = value;
	}
	
	onChange: any = () => {};
	onTouched: any = () => {};

	private _vendor: IOrganizationVendor;
	set vendor(val: IOrganizationVendor) {
		this._vendor = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get vendor(): IOrganizationVendor {
		return this._vendor;
	}

	@Output()
	onChanged = new EventEmitter<IOrganizationVendor>();

	constructor(
		private readonly store: Store,
		private readonly organizationVendorsService: OrganizationVendorsService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService
	) {}

	ngOnInit() {
		this.subject$
		.pipe(
			debounceTime(100),
			tap(() => this.getVendors()),
			untilDestroyed(this)
		)
		.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this.subject$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getVendors() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items: vendors } = await this.organizationVendorsService.getAll({
			organizationId,
			tenantId
		});
		this.vendors = vendors;
	}

	writeValue(value: IOrganizationVendor) {
		if (value) {
			this._vendor = value;
		}
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

	selectVendor(vendor: IOrganizationVendor): void {
		this.vendor = vendor;
		this.onChanged.emit(vendor);
	}

	addVendor = (name: string): Promise<IOrganizationVendor> => {
		try {
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.ADD_VENDOR', {
				name
			});
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			return this.organizationVendorsService.create({
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
