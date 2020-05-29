import { Directive, ElementRef, Renderer2 } from '@angular/core';
import { SliderElementDirective } from './slider-element.directive';
import { ValueHelper } from './value-helper';

@Directive({
	selector: '[ng5SliderLabel]'
})
export class SliderLabelDirective extends SliderElementDirective {
	private _value: string = null;
	get value(): string {
		return this._value;
	}

	constructor(elemRef: ElementRef, renderer: Renderer2) {
		super(elemRef, renderer);
	}

	setValue(value: string): void {
		let recalculateDimension: boolean = false;

		if (
			!this.alwaysHide &&
			(ValueHelper.isNullOrUndefined(this.value) ||
				this.value.length !== value.length ||
				(this.value.length > 0 && this.dimension === 0))
		) {
			recalculateDimension = true;
		}

		this._value = value;
		this.elemRef.nativeElement.innerHTML = value;

		// Update dimension only when length of the label have changed
		if (recalculateDimension) {
			this.calculateDimension();
		}
	}
}
