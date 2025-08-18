import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, interval } from 'rxjs';

/**
 * Interface for timer state
 */
export interface ITimerState {
	countdown: number;
	isActive: boolean;
	isResent: boolean;
}

/**
 * Service to handle countdown timer functionality.
 * Provides a reusable timer that can be shared across components.
 */
@Injectable({
	providedIn: 'root'
})
export class CountdownTimerService implements OnDestroy {
	private readonly _timerState = new BehaviorSubject<ITimerState>({
		countdown: 0,
		isActive: false,
		isResent: false
	});

	private timer?: Subscription;
	private readonly DEFAULT_COUNTDOWN = 30;

	/**
	 * Observable stream of timer state
	 */
	public readonly timerState$: Observable<ITimerState> = this._timerState.asObservable();

	/**
	 * Get current timer state
	 */
	get currentState(): ITimerState {
		return this._timerState.value;
	}

	/**
	 * Get current countdown value
	 */
	get countdown(): number {
		return this._timerState.value.countdown;
	}

	/**
	 * Check if timer is currently active
	 */
	get isActive(): boolean {
		return this._timerState.value.isActive;
	}

	/**
	 * Check if code was resent (timer is running)
	 */
	get isResent(): boolean {
		return this._timerState.value.isResent;
	}

	/**
	 * Starts a countdown timer with the specified duration.
	 *
	 * @param duration The countdown duration in seconds (default: 30)
	 */
	startTimer(duration: number = this.DEFAULT_COUNTDOWN): void {
		if (duration <= 0) {
			this.stopTimer();
			return;
		}
		// Stop any existing interval without resetting state to avoid flicker
		if (this.timer) {
			this.timer.unsubscribe();
			this.timer = undefined;
		}

		// Update state to show timer is active and code was resent
		this._timerState.next({
			countdown: duration,
			isActive: true,
			isResent: true
		});

		// Start the interval timer
		this.timer = interval(1000).subscribe(() => {
			const currentState = this._timerState.value;
			if (currentState.countdown > 0) {
				this._timerState.next({
					...currentState,
					countdown: currentState.countdown - 1
				});
			} else {
				this.stopTimer();
			}
		});
	}

	/**
	 * Stops the timer and resets the state.
	 */
	stopTimer(): void {
		// Unsubscribe from the timer if it exists
		if (this.timer) {
			this.timer.unsubscribe();
			this.timer = undefined;
		}

		// Reset timer state
		this._timerState.next({
			countdown: 0,
			isActive: false,
			isResent: false
		});
	}

	/**
	 * Resets the timer to initial state without starting it.
	 */
	resetTimer(): void {
		this.stopTimer();
	}

	/**
	 * Checks if the timer can be started (not currently active).
	 */
	canStart(): boolean {
		return !this.isActive;
	}

	/**
	 * Cleanup method to be called when the service is destroyed.
	 * This ensures no memory leaks from active subscriptions.
	 */
	ngOnDestroy(): void {
		this.stopTimer();
	}
}
