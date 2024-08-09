import { Directive, ElementRef, EventEmitter, Output, HostListener } from '@angular/core';

@Directive({
	selector: '[gauzyOutside]'
})
export class OutsideDirective {
	constructor(private readonly elementRef: ElementRef) {}

	@Output() clickOutside = new EventEmitter<MouseEvent>();

	/**
	 * Handles the click event outside of the element.
	 *
	 * @param {MouseEvent} event - The click event.
	 * @param {HTMLElement} targetElement - The target element that was clicked.
	 * @return {void} This function does not return anything.
	 */
	@HostListener('document:click', ['$event', '$event.target'])
	public onClick(event: MouseEvent, targetElement: HTMLElement): void {
		if (!targetElement) {
			return;
		}
		const clickedInside = this.elementRef.nativeElement.contains(targetElement);
		this.clickOutside.emit(clickedInside);
	}
}
