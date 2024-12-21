import { Directive, ElementRef, Renderer2, Input } from '@angular/core';

// Interface representing the configuration for text masking
interface IMaskConfig {
	text: string;
	showOriginal: boolean;
	replacement: number;
}

@Directive({
    selector: '[gaTextMask]',
    standalone: false
})
export class TextMaskDirective {
	// Default configuration for text masking
	private readonly _config: IMaskConfig = {
		text: '',
		showOriginal: false,
		replacement: 0.5
	};

	// Constructor to inject dependencies
	constructor(private readonly el: ElementRef, private readonly renderer: Renderer2) {}

	// Apply the configured text mask to the element
	private applyTextMask(): void {
		// Get the text based on the showOriginal configuration
		const text = this.config.showOriginal ? this.config.text : this.maskText(this.config.text);

		// Set the masked or original text to the element's inner text
		this.renderer.setProperty(this.el.nativeElement, 'innerText', text);
	}

	// Mask the given text based on the configured replacement percentage
	private maskText(value: string): string {
		// If text is not provided, return an empty string
		if (!value) {
			return '';
		}

		// Convert the text into an array of characters
		const text = value.split('');

		// Replace the specified percentage of characters with asterisks ('*')
		for (let i = 0; i < Math.floor(this.config.replacement * text.length); i++) {
			text[i] = '*';
		}

		// Join the array back into a string and return the masked text
		return text.join('');
	}

	// Getter for the current configuration
	public get config(): IMaskConfig {
		return this._config;
	}

	// Setter for updating the configuration and applying the text mask
	@Input()
	public set config(partialConfig: Partial<IMaskConfig>) {
		// Merge the provided partial configuration with the default configuration
		Object.assign(this._config, partialConfig);

		// Apply the text mask with the updated configuration
		this.applyTextMask();
	}
}
