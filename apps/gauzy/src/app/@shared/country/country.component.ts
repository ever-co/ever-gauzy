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
import { ICountry } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CountryService } from '../../@core/services/country.service';
import { TranslationBaseComponent } from '../language-base/translation-base.component';

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
export class CountryComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit, ControlValueAccessor {
	private _country: string;

	@Input() formControl: FormControl = new FormControl();
	@Output() selectChange = new EventEmitter<string>();
	@Output() optionChange = new EventEmitter<ICountry>();
	
	countries$: Observable<ICountry[]> = this.countryService.countries$;
	private _countries: ICountry[] = [];

	onChange: any = () => {};
	onTouched: any = () => {};

	@Input()
	set country(val: string) {
		if (val) {
			this._country = val;
			this.onChange(val);
			this.onTouched();
		}
	}
	get country() {
		return this._country;
	}

	constructor(
		private readonly countryService: CountryService,
		public translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
		this.countryService.find$.next(true);
	}

	ngOnInit(): void {
		this.countries$
			.pipe(
				tap((countries: ICountry[]) => (this._countries = countries)),
				tap(() => this.onSelectChange(this.country)),				
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}
	
	onSelectChange(value: string) {
		if (value && this._countries.length > 0) {
			const country = this._countries.find(
				(country: ICountry) => country.isoCode === value
			);
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
