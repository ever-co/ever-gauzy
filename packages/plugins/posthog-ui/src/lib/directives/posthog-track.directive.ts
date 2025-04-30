import { Directive, Input, HostListener, OnInit } from '@angular/core';
import { PostHogServiceManager } from '../services/posthog-manager.service';

/**
 * Directive to automatically track user interactions with PostHog
 *
 * Usage:
 * <button
 *   [phTrack]="'button_clicked'"
 *   [phProperties]="{ buttonName: 'submit' }"
 *   [phOnInit]="true"
 *   [phEventType]="'click'"
 *   [phStopPropagation]="true"
 * >
 *   Submit
 * </button>
 */
@Directive({
	selector: '[phTrack]',
	standalone: true
})
export class PostHogTrackDirective implements OnInit {
	@Input('phTrack') eventName!: string;
	@Input('phProperties') properties: Record<string, unknown> = {};
	@Input('phOnInit') captureOnInit = false;
	@Input('phEventType') eventType = 'click'; // default to click
	@Input('phStopPropagation') stopPropagation = false;

	constructor(private posthogServiceManager: PostHogServiceManager) {}

	ngOnInit(): void {
		if (this.captureOnInit && this.eventName) {
			this.capture();
		}
	}

	@HostListener('click', ['$event'])
	handleClick(event: Event): void {
		if (this.eventType === 'click') {
			this.capture(event);
		}
	}

	@HostListener('mouseenter', ['$event'])
	handleMouseEnter(event: Event): void {
		if (this.eventType === 'mouseenter') {
			this.capture(event);
		}
	}

	@HostListener('focus', ['$event'])
	handleFocus(event: Event): void {
		if (this.eventType === 'focus') {
			this.capture(event);
		}
	}

	private capture(event?: Event): void {
		if (!this.eventName) return;

		if (this.stopPropagation && event) {
			event.stopPropagation();
		}

		this.posthogServiceManager.trackEvent(this.eventName, this.properties);
	}
}
