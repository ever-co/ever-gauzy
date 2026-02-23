import { Directive, ElementRef, NgZone, OnInit, Renderer2, inject } from '@angular/core';
import { asapScheduler } from 'rxjs';

@Directive({
	selector: '[autocomplete-off]',
	standalone: true
})
/**
 * Alterates autocomplete="off" attribute on chrome because it's ignoring it in case of credentials, address or credit card data type.
 */
export class AutocompleteOffDirective implements OnInit {
	private readonly _renderer = inject(Renderer2);
	private readonly _el = inject(ElementRef);
	private readonly _zone = inject(NgZone);

	ngOnInit() {
		this._zone.runOutsideAngular(() => {
			if (this._el.nativeElement && this._el.nativeElement.hasAttribute('autocomplete-off')) {
				/**
				 * disabled autocomplete for form
				 */
				asapScheduler.schedule(() => this._el.nativeElement.setAttribute('autocomplete', 'off'));
				/**
				 * disabled autocomplete for all inputs inside form
				 */
				const inputs = Array.prototype.slice.call(this._el.nativeElement.querySelectorAll('input'));
				inputs.forEach((element: ElementRef) => {
					this._renderer.setAttribute(element, 'autocomplete', 'off');
					this._renderer.setAttribute(element, 'autocorrect', 'off');
					this._renderer.setAttribute(element, 'autocapitalize', 'none');
					this._renderer.setAttribute(element, 'spellcheck', 'false');
				});
			}
		});
	}
}
