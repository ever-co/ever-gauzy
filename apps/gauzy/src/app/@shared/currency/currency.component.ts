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
import {
	ControlValueAccessor,
	FormControl,
	NG_VALUE_ACCESSOR
} from '@angular/forms';
import { ICurrency } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CurrencyService } from '../../@core/services';
import { TranslationBaseComponent } from '../language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-currency',
	templateUrl: './currency.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => CurrencyComponent),
			multi: true
		}
	]
})
export class CurrencyComponent extends TranslationBaseComponent 
	implements OnInit, AfterViewInit, ControlValueAccessor {

	@Input() formControl: FormControl = new FormControl();
	@Output() selectChange = new EventEmitter<string>();
	@Output() optionChange = new EventEmitter<ICurrency>();

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
		this._currency = val;
		this.onChange(val);
		this.onTouched();
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

	constructor(
		private readonly currencyService: CurrencyService,
		public readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
		this.currencyService.find$.next(true);
	}

	ngOnInit(): void {
		this.currencies$
			.pipe(
				tap(
					(currencies: ICurrency[]) => (this._currencies = currencies)
				),
				tap(() => this.loading = false),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	onSelectChange(value: string) {
		if (this._currencies.length > 0) {
			const currency = this._currencies.find(
				(currency: ICurrency) => currency.isoCode === value
			);
			this.onOptionChange(currency);
		}
		this.selectChange.emit(value);
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
