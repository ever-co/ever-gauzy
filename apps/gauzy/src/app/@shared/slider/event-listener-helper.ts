import { Renderer2 } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { throttleTime, tap } from 'rxjs/operators';
import detectPassiveEvents from 'detect-passive-events';

import { EventListener } from './event-listener';
import { ValueHelper } from './value-helper';

/**
 * Helper class to attach event listeners to DOM elements with debounce support using rxjs
 */
export class EventListenerHelper {
	constructor(private renderer: Renderer2) {}

	public attachPassiveEventListener(
		nativeElement: any,
		eventName: string,
		callback: (event: any) => void,
		throttleInterval?: number
	): EventListener {
		// Only use passive event listeners if the browser supports it
		if (detectPassiveEvents.hasSupport !== true) {
			return this.attachEventListener(
				nativeElement,
				eventName,
				callback,
				throttleInterval
			);
		}

		// Angular doesn't support passive event handlers (yet), so we need to roll our own code using native functions
		const listener: EventListener = new EventListener();
		listener.eventName = eventName;
		listener.events = new Subject<Event>();

		const observerCallback: (event: Event) => void = (
			event: Event
		): void => {
			listener.events.next(event);
		};
		nativeElement.addEventListener(eventName, observerCallback, {
			passive: true,
			capture: false
		});

		listener.teardownCallback = (): void => {
			nativeElement.removeEventListener(eventName, observerCallback, {
				passive: true,
				capture: false
			});
		};

		listener.eventsSubscription = listener.events
			.pipe(
				!ValueHelper.isNullOrUndefined(throttleInterval)
					? throttleTime(throttleInterval, undefined, {
							leading: true,
							trailing: true
					  })
					: tap(() => {}) // no-op
			)
			.subscribe((event: Event) => {
				callback(event);
			});

		return listener;
	}

	public detachEventListener(eventListener: EventListener): void {
		if (!ValueHelper.isNullOrUndefined(eventListener.eventsSubscription)) {
			eventListener.eventsSubscription.unsubscribe();
			eventListener.eventsSubscription = null;
		}

		if (!ValueHelper.isNullOrUndefined(eventListener.events)) {
			eventListener.events.complete();
			eventListener.events = null;
		}

		if (!ValueHelper.isNullOrUndefined(eventListener.teardownCallback)) {
			eventListener.teardownCallback();
			eventListener.teardownCallback = null;
		}
	}

	public attachEventListener(
		nativeElement: any,
		eventName: string,
		callback: (event: any) => void,
		throttleInterval?: number
	): EventListener {
		const listener: EventListener = new EventListener();
		listener.eventName = eventName;
		listener.events = new Subject<Event>();

		const observerCallback: (event: Event) => void = (
			event: Event
		): void => {
			listener.events.next(event);
		};

		listener.teardownCallback = this.renderer.listen(
			nativeElement,
			eventName,
			observerCallback
		);

		listener.eventsSubscription = listener.events
			.pipe(
				!ValueHelper.isNullOrUndefined(throttleInterval)
					? throttleTime(throttleInterval, undefined, {
							leading: true,
							trailing: true
					  })
					: tap(() => {}) // no-op
			)
			.subscribe((event: Event) => {
				callback(event);
			});

		return listener;
	}
}
