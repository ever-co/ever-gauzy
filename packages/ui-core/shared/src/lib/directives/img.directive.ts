import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { environment } from '@gauzy/ui-config';
import { AVATAR_DEFAULT_SVG, DEFAULT_SVG } from '@gauzy/ui-core/common';

@Directive({
    selector: 'img',
    standalone: false
})
export class ImgDirective implements OnDestroy, OnInit {
	@Input() type: 'user' | 'default' = 'default';
	private el: HTMLElement;

	constructor(el: ElementRef) {
		this.el = el.nativeElement;
	}

	public defaultImg() {
		if (this.type === 'user') {
			return environment.IS_ELECTRON ? `./${AVATAR_DEFAULT_SVG}` : `/${AVATAR_DEFAULT_SVG}`;
		} else {
			return environment.IS_ELECTRON ? `./${DEFAULT_SVG}` : `/${DEFAULT_SVG}`;
		}
	}

	ngOnInit(): void {
		let src = this.el.getAttribute('src');
		if (src && src.indexOf('http') !== 0) {
			src = environment.IS_ELECTRON ? `./${src}` : `/${src}`;
		}
		this.el.setAttribute('src', src);
		this.el.addEventListener('error', this.onError.bind(this));
		this.el.addEventListener('load', this.onLoad.bind(this));
	}

	/**
	 * Handles the error event when the image fails to load.
	 *
	 * This function removes the error event listener, sets the opacity of the element to 0,
	 * retrieves the current source of the image, sets the source of the image to the default image,
	 * sets the data attribute 'data-original-src' to the current source,
	 * appends the class 'default-image default-image-{type}' to the element's class list,
	 * and removes the load event listener.
	 *
	 * @private
	 */
	private onError() {
		this.removeErrorEvent();

		this.el.style.opacity = '0';

		const src = this.el.getAttribute('src');
		this.el.setAttribute('src', this.defaultImg());
		this.el.setAttribute('data-original-src', src);

		const classList: any = this.el.classList;
		this.el.setAttribute('class', classList.value + ` default-image default-image-${this.type}`);

		this.removeOnLoadEvent();
	}

	/**
	 * Sets the opacity of the element to 1 when the image has finished loading.
	 *
	 * @private
	 */
	private onLoad() {
		this.el.style.opacity = '1';
	}

	/**
	 * Removes the error event listener from the element.
	 *
	 * @private
	 */
	private removeErrorEvent() {
		this.el.removeEventListener('error', this.onError);
	}

	/**
	 * Removes the load event listener from the element.
	 *
	 * @private
	 */
	private removeOnLoadEvent() {
		this.el.removeEventListener('load', this.onLoad);
	}

	ngOnDestroy() {
		this.removeErrorEvent();
		this.removeOnLoadEvent();
	}
}
