import { Directive, ElementRef, EventEmitter, HostListener, Input, Output, Renderer2 } from '@angular/core';

// Interface representing the configuration for text masking
interface IMaskConfig {
	text: string;
	showOriginal: boolean;
	replacement: number;
	maskFromLeft: boolean; // New property to control mask direction
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
		replacement: 0.5,
		maskFromLeft: true // Default is to mask from the left
	};

	// Store the original value internally
	private originalValue: string = '';

	@Output() unmaskedValueChange = new EventEmitter<string>();

	constructor(private readonly el: ElementRef, private readonly renderer: Renderer2) {}

	// Apply the configured text mask to the input element (show masked, keep original)
	private applyTextMask(): void {
		const { showOriginal, text } = this.config;
		const maskedText = showOriginal ? text : this.getMaskedText(text);
		this.renderer.setProperty(this.el.nativeElement, 'value', maskedText);
	}

	// Mask the given text based on the replacement percentage and direction
	private getMaskedText(value: string): string {
		if (!value) return '';

		const maskLength = Math.floor(this.config.replacement * value.length);
		const maskedSection = '*'.repeat(maskLength);

		// Determine whether to mask from the left or the right
		if (this.config.maskFromLeft) {
			const remainingSection = value.slice(maskLength);
			return maskedSection + remainingSection;
		} else {
			const visibleSection = value.slice(0, value.length - maskLength);
			return visibleSection + maskedSection;
		}
	}

	// Listen to input changes and update the original value while applying the mask
	@HostListener('input', ['$event.target.value'])
	onInput(value: string): void {
		// Store the original value without masking
		this.originalValue = value;

		// Emit the unmasked value to the outside world
		this.unmaskedValueChange.emit(this.originalValue);

		// Apply the mask on the input field
		this.config = { ...this.config, text: value };
	}

	// Getter for the current configuration
	public get config(): IMaskConfig {
		return this._config;
	}

	// Setter for updating the configuration and applying the text mask
	@Input()
	public set config(partialConfig: Partial<IMaskConfig>) {
		Object.assign(this._config, partialConfig);
		this.applyTextMask(); // Re-apply text mask after config change
	}
}
