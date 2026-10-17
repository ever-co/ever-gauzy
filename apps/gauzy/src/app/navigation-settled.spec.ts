import {
	Event,
	NavigationCancel,
	NavigationCancellationCode,
	NavigationEnd,
	NavigationError,
	NavigationStart
} from '@angular/router';
import { Subject } from 'rxjs';
import { endsWithoutReplacement, unsettledNavigations } from './navigation-settled';

/**
 * Q8d: the app's loading skeleton waited for a `NavigationEnd` only, so a stale session whose first navigation failed
 * or was refused stayed on the skeleton over an outlet that would never fill (Greptile on #10888 asked for these cases).
 */
describe('unsettledNavigations — when the loading skeleton may go without a NavigationEnd', () => {
	const cancel = (code: NavigationCancellationCode) => new NavigationCancel(1, '/pages', 'refused', code);

	function watch(pending: () => unknown = () => null) {
		const events = new Subject<Event>();
		const settled = jest.fn();
		const subscription = unsettledNavigations({ events, getCurrentNavigation: pending } as never).subscribe(
			settled
		);

		return { events, settled, subscription };
	}

	beforeEach(() => jest.useFakeTimers());

	afterEach(() => jest.useRealTimers());

	it('settles after a navigation error that nothing follows', () => {
		const { events, settled } = watch();

		events.next(new NavigationError(1, '/pages', new Error('guard rejected')));
		jest.runOnlyPendingTimers();

		expect(settled).toHaveBeenCalledTimes(1);
	});

	it('settles after a refusal that nothing follows', () => {
		const { events, settled } = watch();

		events.next(cancel(NavigationCancellationCode.GuardRejected));
		jest.runOnlyPendingTimers();

		expect(settled).toHaveBeenCalledTimes(1);
	});

	it.each([
		['a redirect', NavigationCancellationCode.Redirect],
		['a newer navigation', NavigationCancellationCode.SupersededByNewNavigation]
	])('waits for the navigation that replaces one cancelled by %s', (_name, code) => {
		const { events, settled } = watch();

		events.next(cancel(code));
		jest.runOnlyPendingTimers();

		expect(settled).not.toHaveBeenCalled();
	});

	it('keeps waiting while a replacement navigation is under way', () => {
		const { events, settled } = watch(() => ({ id: 2 }));

		events.next(cancel(NavigationCancellationCode.GuardRejected));
		jest.runOnlyPendingTimers();

		expect(settled).not.toHaveBeenCalled();
	});

	it('does not decide before the guard had a chance to start its replacement', () => {
		const { events, settled } = watch();

		events.next(new NavigationError(1, '/pages', new Error('x')));

		expect(settled).not.toHaveBeenCalled();
	});

	it('ignores the ordinary events of a navigation', () => {
		expect(endsWithoutReplacement(new NavigationStart(1, '/pages'))).toBe(false);
		expect(endsWithoutReplacement(new NavigationEnd(1, '/pages', '/pages'))).toBe(false);
	});
});
