import { Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';

@Directive({
    selector: '[gaTooltip]',
    standalone: false
})
export class TooltipDirective implements OnDestroy {
	@Input() gaTooltip: string;
	@Input() icon: string;
	private popup: any;

	constructor(private readonly el: ElementRef) {}

	ngOnDestroy(): void {
		if (this.popup) this.popup.remove();
	}

	/**
	 * Handles the mouse enter event and creates a tooltip popup at the middle of the element.
	 *
	 * @return {void} This function does not return anything.
	 */
	@HostListener('mouseenter') onMouseEnter(): void {
		const x = this.el.nativeElement.getBoundingClientRect().left + this.el.nativeElement.offsetWidth / 2; // Get the middle of the element
		const y = this.el.nativeElement.getBoundingClientRect().top + this.el.nativeElement.offsetHeight + 6; // Get the bottom of the element, plus a little extra
		this.createTooltipPopup(x, y);
	}

	/**
	 * Removes the tooltip popup if it exists when the mouse leaves the element.
	 *
	 * @return {void} This function does not return anything.
	 */
	@HostListener('mouseleave') onMouseLeave(): void {
		if (this.popup) this.popup.remove();
	}

	/**
	 * Creates a tooltip popup at the specified coordinates.
	 *
	 * @param {number} x - The x-coordinate of the popup.
	 * @param {number} y - The y-coordinate of the popup.
	 * @return {void} This function does not return anything.
	 */
	private createTooltipPopup(x: number, y: number): void {
		const popup = document.createElement('div');
		popup.innerHTML = "<i class='" + this.icon + "'></i>" + this.gaTooltip;
		popup.setAttribute('class', 'tooltip-container');
		popup.style.top = y.toString() + 'px';
		popup.style.left = x.toString() + 'px';
		document.body.appendChild(popup);
		this.popup = popup;
	}
}
