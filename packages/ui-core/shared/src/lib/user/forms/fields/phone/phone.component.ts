import { Component, EventEmitter, forwardRef, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NG_VALUE_ACCESSOR } from "@angular/forms";
import { UntilDestroy } from "@ngneat/until-destroy";

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-phone-form-input',
	templateUrl: './phone.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => PhoneFormInputComponent),
			multi: true
		}
	]
})
export class PhoneFormInputComponent implements OnInit, OnDestroy {

	onChange: any = () => { };
	onTouched: any = () => { };

	/*
	* Getter & Setter for dynamic phone number option
	*/
	private _phoneNumber: string;
	@Input() set phoneNumber(val: string) {
		this._phoneNumber = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get phoneNumber(): string {
		return this._phoneNumber;
	}

	/*
	* Getter & Setter for placeholder
	*/
	private _placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	@Output() onChanged = new EventEmitter<string>();

	constructor() { }

	/**
	 *
	 */
	ngOnInit(): void { }

	/**
	 *
	 * @param value
	 */
	writeValue(value: string) {
		if (value) {
			this._phoneNumber = value;
		}
	}

	/**
	 *
	 * @param fn
	 */
	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	/**
	 *
	 * @param fn
	 */
	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	/**
	 *
	 */
	ngOnDestroy(): void { }
}
