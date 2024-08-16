import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
	selector: '[triggerParentClick]'
})
export class TriggerParentClickDirective {
	constructor(private readonly el: ElementRef) {}

	@HostListener('click', ['$event'])
	onClick(event: Event) {
		// Get the parent element
		const parent = this.el.nativeElement.parentElement;

		// Trigger the click event on the parent element
		if (parent) {
			const parentClickEvent = new MouseEvent('click', { bubbles: false, cancelable: true });
			parent.dispatchEvent(parentClickEvent);
		}

		// Stop the event from propagating to prevent any other handlers
		event.stopPropagation();
	}
}
