import { Directive, forwardRef, ElementRef, HostListener } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Directive({
	selector: '[timeMask]',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TimeMaskDirective),
			multi: true
		}
	]
})
export class TimeMaskDirective implements ControlValueAccessor {
	private onChange: (value: string | null) => void = () => {};
	onTouched: () => void = () => {};

	constructor(private readonly el: ElementRef) {}

	@HostListener('input', ['$event'])
	onInput(event: Event) {
		const inputElement = event.target as HTMLInputElement;
		if (!inputElement) return;

		const prevValue = inputElement.value;
		const cursorPosition = inputElement.selectionStart || 0;
		let rawValue = prevValue.replace(/[^0-9]/g, '');
		rawValue = rawValue.substring(0, 6);

		let formattedValue = '';
		if (rawValue.length > 0) formattedValue += rawValue.substring(0, 2);
		if (rawValue.length > 2) formattedValue += ':' + rawValue.substring(2, 4);
		if (rawValue.length > 4) formattedValue += ':' + rawValue.substring(4, 6);

		inputElement.value = formattedValue;
		let newCursorPos = cursorPosition;

		if (prevValue.length > formattedValue.length) {
			if (formattedValue[cursorPosition - 1] === ':') {
				newCursorPos--;
			}
		} else if (formattedValue[cursorPosition] === ':') {
			newCursorPos++;
		}

		if (prevValue.length < formattedValue.length && cursorPosition === prevValue.length) {
			newCursorPos = formattedValue.length;
		}

		inputElement.setSelectionRange(newCursorPos, newCursorPos);
		this.onChange(formattedValue.length === 8 ? formattedValue : null);
	}

	writeValue(value: string | null): void {
		this.el.nativeElement.value = value || '';
	}

	registerOnChange(fn: (value: string | null) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}
}
