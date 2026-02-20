import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
	selector: '[noSpaceEdges]',
	standalone: true
})
export class NoSpaceEdgesDirective {
	private readonly el = inject(ElementRef);

	/**
	 * Trims the input value and updates the element's value.
	 *
	 * @param {string} value - The input value to be trimmed.
	 * @return {void} This function does not return anything.
	 */
	@HostListener('input', ['$event.target.value'])
	onInput(value: string) {
		this.el.nativeElement.value = value.trim();
	}
}
