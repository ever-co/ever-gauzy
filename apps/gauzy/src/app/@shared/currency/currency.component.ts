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
import { ICurrency } from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs/Observable';
import { tap } from 'rxjs/operators';
import { CurrencyService } from '../../@core/services/currency.service';
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
export class CurrencyComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit, ControlValueAccessor {
	private _currency: string;

	@Input() formControl: FormControl = new FormControl();
	@Output() selectChange = new EventEmitter<string>();
	@Output() optionChange = new EventEmitter<ICurrency>();

	currencies$: Observable<ICurrency[]> = this.currencyService.currencies$;
	private _currencies: ICurrency[] = [];

	onChange: any = () => {};
	onTouched: any = () => {};

	@Input()
	set currency(val: string) {
		if (val) {
			this._currency = val;
			this.onChange(val);
			this.onTouched();
		}
	}
	get currency() {
		return this._currency;
	}

	constructor(
		private readonly currencyService: CurrencyService,
		public translateService: TranslateService,
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
