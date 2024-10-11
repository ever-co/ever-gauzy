import { Directive, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject, Subscription, tap } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Directive({
	selector: '[debounceClick]'
})
export class DebounceClickDirective implements OnInit, OnDestroy {
	private clicks: Subject<Event> = new Subject<Event>();
	private subscription: Subscription;

	@Input() debounceTime = 300;
	@Output() throttledClick: EventEmitter<Event> = new EventEmitter<Event>();

	/**
	 * Handles the click event and emits it after a debounce time.
	 *
	 * @param {Event} event - The click event object.
	 * @return {void} This function does not return a value.
	 */
	@HostListener('click', ['$event'])
	clickEvent(event: Event): void {
		this.clicks.next(event);
	}

	ngOnInit() {
		this.subscription = this.clicks
			.pipe(
				debounceTime(this.debounceTime),
				tap((e) => this.throttledClick.emit(e))
			)
			.subscribe();
	}

	ngOnDestroy() {
		this.subscription.unsubscribe();
	}
}
