import {
	Component,
	OnDestroy,
	Input,
	forwardRef,
	AfterViewInit,
	OnChanges,
	ElementRef,
	ViewChild,
	EventEmitter,
	Output
} from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime } from 'rxjs/operators';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-sdk/common';
import { NbComponentSize } from '@nebular/theme';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-password-form-field',
	templateUrl: './password.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => PasswordFormFieldComponent),
			multi: true
		}
	]
})
export class PasswordFormFieldComponent
	extends TranslationBaseComponent
	implements ControlValueAccessor, AfterViewInit, OnChanges, OnDestroy
{
	showPassword: boolean = false;

	//The internal data model for form control value access
	private innerValue: any = '';

	onChange = (_: any) => {};
	onTouched = (_: any) => {};

	/**
	 * Getter & Setter accessor including call the onchange callback
	 */
	get value(): any {
		return this.innerValue;
	}
	set value(v: any) {
		if (v !== this.innerValue) {
			this.innerValue = v;
		}
	}

	/*
	 * Getter & Setter accessor for dynamic form control
	 */
	_ctrl: FormControl = new FormControl();
	get ctrl(): FormControl {
		return this._ctrl;
	}
	@Input() set ctrl(value: FormControl) {
		this._ctrl = value;
	}

	/*
	 * Getter & Setter for dynamic label
	 */
	_label: string;
	get label(): string {
		return this._label;
	}
	@Input() set label(value: string) {
		this._label = value;
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
	 * Getter & Setter accessor for dynamic placeholder
	 */
	_icon: boolean = true;
	get icon(): boolean {
		return this._icon;
	}
	@Input() set icon(value: boolean) {
		this._icon = value;
	}

	// ID attribute for the field and for attribute for the label
	_id: string;
	get id(): string {
		return this._id;
	}
	@Input() set id(value: string) {
		this._id = value;
	}

	/*
	 * Getter & Setter for dynamic field size
	 */
	_fieldSize: NbComponentSize = 'medium';
	get fieldSize(): NbComponentSize {
		return this._fieldSize;
	}
	@Input() set fieldSize(value: NbComponentSize) {
		this._fieldSize = value;
	}

	/*
	 * Getter & Setter for dynamic classList
	 */
	_ngClass: string;
	get ngClass(): string {
		return this._ngClass;
	}
	@Input() set ngClass(value: string) {
		this._ngClass = value;
	}

	// Property binding to autocomplete
	@Input() autocomplete: string;

	@Output() onInputChanged = new EventEmitter<string>();

	// get reference to the input element
	@ViewChild('input') inputRef: ElementRef;

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnChanges() {}

	ngAfterViewInit() {
		this.ctrl.valueChanges.pipe(debounceTime(100), distinctUntilChange(), untilDestroyed(this)).subscribe(() => {
			// check condition if the form control is RESET
			if (isEmpty(this.ctrl.value)) {
				this.innerValue = '';
				this.inputRef.nativeElement.value = '';
			}
			this.onInputChanged.emit(this.ctrl.value);
		});
	}

	// event fired when input value is changed. later propagated up to the form control using the custom value accessor interface
	onInputChange(e: Event, value: any) {
		//set changed value
		this.innerValue = value;

		// propagate value into form control using control value accessor interface
		this.onChange(this.innerValue);
	}

	//from control value accessor interface
	writeValue(value: any) {
		this.innerValue = value;
	}

	//from control value accessor interface
	registerOnChange(fn: any) {
		this.onChange = fn;
	}

	//from control value accessor interface
	registerOnTouched(fn: any) {
		this.onTouched = fn;
	}

	ngOnDestroy() {}
}
