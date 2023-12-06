import { Directive, ElementRef, Renderer2, Input } from '@angular/core';

interface IMaskConfig {
	text: string;
	showOriginal: boolean;
	replacement: number;
}

@Directive({
	selector: '[gaTextMask]'
})
export class TextMaskDirective {
	private readonly _config: IMaskConfig;

	constructor(private el: ElementRef, private renderer: Renderer2) {
		this._config = {
			text: '',
			showOriginal: false,
			replacement: 0.5
		};
	}

	private applyTextMask() {
		const text = this.config.showOriginal ? this.config.text : this.maskText(this.config.text);
		this.renderer.setProperty(this.el.nativeElement, 'innerText', text);
	}

	private maskText(text: string): string {
		if (!text) {
			return '';
		}

		const textArray = text.split('');

		for (let i = 0; i < textArray.length; i++) {
			if (i < Math.floor(this.config.replacement * textArray.length)) {
				textArray[i] = '*';
			}
		}

		return textArray.join('');
	}

	public get config(): IMaskConfig {
		return this._config;
	}

	@Input()
	public set config(partialConfig: Partial<IMaskConfig>) {
		Object.assign(this._config, partialConfig);
		this.applyTextMask();
	}
}
