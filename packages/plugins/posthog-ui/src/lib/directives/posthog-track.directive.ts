import { Directive, Input, HostListener, ElementRef } from '@angular/core';
import { PostHogServiceManager } from '../services/posthog-manager.service';

/**
 * Directive pour capturer facilement des événements de clic avec PostHog
 * Exemple: <button posthogTrack="button_clicked" [posthogProps]="{button_name: 'submit'}">Click me</button>
 */
@Directive({
	selector: '[posthogTrack]'
})
export class PostHogTrackDirective {
	@Input('posthogTrack') eventName: string = '';
	@Input('posthogProps') properties: Record<string, any> = {};

	constructor(private el: ElementRef, private posthogManager: PostHogServiceManager) {}

	@HostListener('click', ['$event'])
	onClick(event: Event): void {
		if (!this.eventName) {
			return;
		}

		// Capturer des informations supplémentaires sur l'élément
		const element = this.el.nativeElement;
		const elementProperties = {
			element_type: element.tagName.toLowerCase(),
			element_text: element.textContent?.trim() || '',
			element_id: element.id || undefined,
			element_class: element.className || undefined,
			...this.properties
		};

		// Capturer l'événement avec PostHog
		this.posthogManager.trackEvent(this.eventName, elementProperties);
	}
}
