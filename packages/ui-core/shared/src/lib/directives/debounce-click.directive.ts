import { Directive, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { debounceTime, Subject, Subscription, tap } from 'rxjs';

@Directive({
    selector: '[debounceClick]',
    standalone: false
})
export class DebounceClickDirective implements OnInit, OnDestroy {
	private clicks = new Subject();
	private subscription: Subscription;

	@Input() debounceTime = 300;
	@Output() throttledClick = new EventEmitter();

	/**
	 * Handles the click event and emits it after a debounce time.
	 *
	 * @param {Event} event - The click event object.
	 * @return {void} This function does not return a value.
	 */
	@HostListener('click', ['$event'])
	clickEvent(event: Event): void {
		event.preventDefault();
		event.stopPropagation();
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
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}
}
