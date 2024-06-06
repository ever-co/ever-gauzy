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
import { ICountry, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CountryService, distinctUntilChange, Store } from '@gauzy/ui-sdk/common';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { environment as ENV } from '@gauzy/ui-config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-country',
	templateUrl: './country.component.html',
	styleUrls: ['./country.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => CountryComponent),
			multi: true
		}
	]
})
export class CountryComponent extends TranslationBaseComponent implements OnInit, AfterViewInit, ControlValueAccessor {
	@Input() formControl: FormControl = new FormControl();
	@Output() optionChange = new EventEmitter<ICountry>();

	public organization: IOrganization;
	loading: boolean = true;
	countries$: Observable<ICountry[]> = this.countryService.countries$;
	private _countries: ICountry[] = [];

	onChange: any = () => {};
	onTouched: any = () => {};

	/*
	 * Getter & Setter for dynamic selected country
	 */
	private _country: string;
	get country() {
		return this._country;
	}
	@Input() set country(val: string) {
		if (val) {
			this._country = val;
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

	constructor(
		private readonly countryService: CountryService,
		public translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef,
		private readonly store: Store
	) {
		super(translateService);
		this.countryService.find$.next(true);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(({ contact }: IOrganization) => {
					this.country = contact ? contact.country : ENV.DEFAULT_COUNTRY;
					this.formControl.updateValueAndValidity();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.countries$
			.pipe(
				tap((countries: ICountry[]) => (this._countries = countries)),
				tap(() => this.onSelectChange(this.country)),
				tap(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	onSelectChange(value: string) {
		if (value && this._countries.length > 0) {
			const country = this._countries.find((country: ICountry) => country.isoCode === value);
			this.country = country.isoCode;
			this.onOptionChange(country);
		}
	}

	onOptionChange($event: ICountry) {
		this.optionChange.emit($event);
	}

	writeValue(value: any) {
		if (value) {
			this.country = value;
		}
		this.cdr.detectChanges();
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	searchCountry(term: string, item: any) {
		return (
			item.isoCode.toLowerCase().includes(term.toLowerCase()) ||
			item.country.toLowerCase().includes(term.toLowerCase())
		);
	}
}
