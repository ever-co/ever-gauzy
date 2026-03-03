import { Directive, ElementRef, HostListener, Input, OnDestroy, Renderer2, inject } from '@angular/core';

@Directive({
	selector: '[gaTooltip]',
	standalone: true
})
export class TooltipDirective implements OnDestroy {
	private readonly _el = inject(ElementRef);
	private readonly _renderer = inject(Renderer2);

	@Input() gaTooltip: string;
	@Input() icon: string;

	private _popup: HTMLElement | null = null;

	ngOnDestroy(): void {
		this._removeTooltip();
	}

	/**
	 * Handles the mouse enter event and creates a tooltip popup at the middle of the element.
	 */
	@HostListener('mouseenter')
	onMouseEnter(): void {
		const rect = this._el.nativeElement.getBoundingClientRect();
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height + 6;
		this._createTooltipPopup(x, y);
	}

	/**
	 * Removes the tooltip popup when the mouse leaves the element.
	 */
	@HostListener('mouseleave')
	onMouseLeave(): void {
		this._removeTooltip();
	}

	/**
	 * Creates a tooltip popup at the specified coordinates.
	 *
	 * @param x - The x-coordinate of the popup.
	 * @param y - The y-coordinate of the popup.
	 */
	private _createTooltipPopup(x: number, y: number): void {
		this._removeTooltip();

		const popup = this._renderer.createElement('div') as HTMLElement;

		// Build content safely using Renderer2 instead of innerHTML
		if (this.icon) {
			const iconEl = this._renderer.createElement('i');
			this._renderer.setAttribute(iconEl, 'class', this.icon);
			this._renderer.appendChild(popup, iconEl);
		}

		const text = this._renderer.createText(this.gaTooltip ?? '');
		this._renderer.appendChild(popup, text);

		this._renderer.setAttribute(popup, 'class', 'tooltip-container');
		this._renderer.setStyle(popup, 'top', `${y}px`);
		this._renderer.setStyle(popup, 'left', `${x}px`);
		this._renderer.appendChild(document.body, popup);

		this._popup = popup;
	}

	/**
	 * Removes the tooltip popup from the DOM if it exists.
	 */
	private _removeTooltip(): void {
		if (this._popup) {
			this._renderer.removeChild(document.body, this._popup);
			this._popup = null;
		}
	}
}
