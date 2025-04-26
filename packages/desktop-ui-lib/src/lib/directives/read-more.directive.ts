import { AfterViewInit, Directive, ElementRef, Input, Renderer2 } from '@angular/core';

@Directive({
	selector: '[readMore]',
	standalone: false
})
export class ReadMoreDirective implements AfterViewInit {
	@Input('readMore') maxLength = 100;
	@Input() readMoreText = 'Read More';
	@Input() readLessText = 'Read Less';

	private originalText: string = '';
	private isExpanded: boolean = false;
	private toggleButton: HTMLButtonElement;

	constructor(private el: ElementRef, private renderer: Renderer2) {}

	ngAfterViewInit() {
		// Store the original text
		this.originalText = this.el.nativeElement.textContent.trim();

		// If text is shorter than max length, do nothing
		if (this.originalText.length <= this.maxLength) {
			return;
		}

		// Truncate the text initially
		this.truncateText();

		// Create toggle button
		this.createToggleButton();
	}

	private truncateText() {
		const truncatedText = this.originalText.slice(0, this.maxLength) + '...';
		this.renderer.setProperty(this.el.nativeElement, 'textContent', truncatedText);
	}

	private createToggleButton() {
		// Create button element
		this.toggleButton = this.renderer.createElement('button');

		// Set button text and styling
		this.renderer.setProperty(this.toggleButton, 'textContent', this.readMoreText);
		this.renderer.setStyle(this.toggleButton, 'background', 'none');
		this.renderer.setStyle(this.toggleButton, 'color', 'var(--color-primary-default)');
		this.renderer.setStyle(this.toggleButton, 'border', 'none');
		this.renderer.setStyle(this.toggleButton, 'cursor', 'pointer');

		// Add click event listener
		this.renderer.listen(this.toggleButton, 'click', () => this.toggleText());

		// Insert button after the element
		this.renderer.insertBefore(
			this.el.nativeElement.parentNode,
			this.toggleButton,
			this.el.nativeElement.nextSibling
		);
	}

	private toggleText() {
		if (this.isExpanded) {
			// Collapse text
			this.truncateText();
			this.renderer.setProperty(this.toggleButton, 'textContent', this.readMoreText);
			this.isExpanded = false;
		} else {
			// Expand text
			this.renderer.setProperty(this.el.nativeElement, 'textContent', this.originalText);
			this.renderer.setProperty(this.toggleButton, 'textContent', this.readLessText);
			this.isExpanded = true;
		}
	}
}
