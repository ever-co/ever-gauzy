import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	forwardRef,
	Input,
	OnInit,
	Output
} from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { filter, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ICurrency, IOrganization } from '@gauzy/contracts';
import { environment as ENV } from '@gauzy/ui-config';
import { CurrencyService, distinctUntilChange, isNotEmpty, Store } from '@gauzy/ui-sdk/common';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-currency',
	templateUrl: './currency.component.html',
	styleUrls: ['./currency.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => CurrencyComponent),
			multi: true
		}
	]
})
export class CurrencyComponent extends TranslationBaseComponent implements OnInit, AfterViewInit, ControlValueAccessor {
	@Input() formControl: FormControl = new FormControl();
	@Output() optionChange = new EventEmitter<ICurrency>();

	public organization: IOrganization;
	loading: boolean = true;
	currencies$: Observable<ICurrency[]> = this.currencyService.currencies$;
	private _currencies: ICurrency[] = [];

	onChange: any = () => {};
	onTouched: any = () => {};

	/*
	 * Getter & Setter for dynamic selected currency
	 */
	private _currency: string;
	get currency() {
		return this._currency;
	}
	@Input() set currency(val: string) {
		if (isNotEmpty(val)) {
			this._currency = val;
			this.onChange(val);
			this.onTouched();
		}
	}

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	private _placeholder: string;
	get placeholder() {
		return this._placeholder;
	}
	@Input() set placeholder(val: string) {
		if (val) {
			this._placeholder = val;
		}
	}

	/*
	 * Getter & Setter for dynamic label display
	 */
	private _label: boolean = true;
	get label() {
		return this._label;
	}
	@Input() set label(val: boolean) {
		this._label = val;
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef,
		private readonly currencyService: CurrencyService,
		private readonly store: Store
	) {
		super(translateService);
		this.currencyService.find$.next(true);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(({ currency }) => {
					this.currency = currency || ENV.DEFAULT_CURRENCY;
				}),
				tap(({ currency }) => {
					this.formControl.setValue(currency);
					this.formControl.updateValueAndValidity();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.currencies$
			.pipe(
				tap((currencies: ICurrency[]) => (this._currencies = currencies)),
				tap(() => this.onSelectChange(this.currency)),
				tap(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	onSelectChange(value: string) {
		if (this._currencies.length > 0) {
			const currency = this._currencies.find((currency: ICurrency) => currency.isoCode === value);
			this.currency = !!currency ? currency.isoCode : null;
			this.onOptionChange(currency);
		}
	}

	onOptionChange($event: ICurrency) {
		this.optionChange.emit($event);
	}

	searchCurrency(term: string, item: any) {
		return (
			item.isoCode.toLowerCase().includes(term.toLowerCase()) ||
			item.currency.toLowerCase().includes(term.toLowerCase())
		);
	}

	writeValue(value: any) {
		if (value) {
			this.currency = value;
		}
		this.cdr.detectChanges();
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}
}
