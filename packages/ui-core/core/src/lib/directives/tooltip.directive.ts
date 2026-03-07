import { isPlatformBrowser } from '@angular/common';
import { Directive, ElementRef, HostListener, Input, OnDestroy, PLATFORM_ID, inject } from '@angular/core';

@Directive({
	selector: '[gaTooltip]',
	standalone: true
})
export class TooltipDirective implements OnDestroy {
	private readonly el = inject(ElementRef);
	private readonly platformId = inject(PLATFORM_ID);
	private popup: HTMLDivElement | null = null;

	@Input() gaTooltip: string;
	@Input() icon: string;

	/**
	 * Handles the mouse enter event and creates a tooltip popup at the middle of the element.
	 *
	 * @return {void} This function does not return anything.
	 */
	@HostListener('mouseenter')
	onMouseEnter(): void {
		const rect = this.el.nativeElement.getBoundingClientRect();
		const x = rect.left + window.scrollX + this.el.nativeElement.offsetWidth / 2; // Get the middle of the element (page coordinates)
		const y = rect.top + window.scrollY + this.el.nativeElement.offsetHeight + 6; // Get the bottom of the element, plus a little extra (page coordinates)
		this.createTooltipPopup(x, y);
	}

	/**
	 * Removes the tooltip popup if it exists when the mouse leaves the element.
	 *
	 * @return {void} This function does not return anything.
	 */
	@HostListener('mouseleave')
	onMouseLeave(): void {
		this.removeTooltip();
	}

	/**
	 * Removes the tooltip popup from the DOM and clears the reference.
	 */
	private removeTooltip(): void {
		if (this.popup) {
			this.popup.remove();
			this.popup = null;
		}
	}

	/**
	 * Creates a tooltip popup at the specified coordinates.
	 *
	 * @param {number} x - The x-coordinate of the popup.
	 * @param {number} y - The y-coordinate of the popup.
	 */
	private createTooltipPopup(x: number, y: number): void {
		if (!isPlatformBrowser(this.platformId)) return;

		this.removeTooltip();

		const popup = document.createElement('div');

		// Create icon element safely
		if (this.icon) {
			const iconElement = document.createElement('i');
			iconElement.className = this.icon;
			popup.appendChild(iconElement);
		}

		// Add text content safely (no HTML injection)
		const textNode = document.createTextNode(this.gaTooltip || '');
		popup.appendChild(textNode);

		popup.setAttribute('class', 'tooltip-container');
		popup.style.top = y.toString() + 'px';
		popup.style.left = x.toString() + 'px';
		document.body.appendChild(popup);
		this.popup = popup;
	}

	ngOnDestroy(): void {
		this.removeTooltip();
	}
}
