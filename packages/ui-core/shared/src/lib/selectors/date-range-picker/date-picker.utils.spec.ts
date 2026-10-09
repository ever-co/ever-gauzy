import moment from 'moment';
import { selectUnitOfTime } from './date-picker.utils';

/**
 * The precedence rule the header picker applies to decide which unit it runs at. It is exercised
 * here rather than through `DateRangePickerComponent` because the component's decision is the part
 * that can silently regress — and standing the component up would pull the whole app graph into
 * the suite. Each test names the step of a real navigation it stands for.
 */
describe('selectUnitOfTime — the route wins on entry, the URL wins in-page', () => {
	describe('arriving on a route', () => {
		it('takes the unit off a freshly resolved config, whatever the URL still says', () => {
			// Sidebar navigation from a week page onto Time & Activity: the resolver has already
			// settled 'day' for this route, and a `unit_of_time=week` left in the URL by the page
			// the user came from must not survive the move.
			const unit = selectUnitOfTime({
				isNewRouteConfig: true,
				routeUnitOfTime: 'day',
				queryUnitOfTime: 'week',
				currentUnitOfTime: 'week'
			});

			expect(unit).toBe('day');
		});

		it.each([
			['day', 'week'],
			['week', 'day'],
			['month', 'week'],
			['day', 'month']
		])('a %s route overrides a stale %s in the URL', (routeUnitOfTime, queryUnitOfTime) => {
			const unit = selectUnitOfTime({
				isNewRouteConfig: true,
				routeUnitOfTime: routeUnitOfTime as moment.unitOfTime.Base,
				queryUnitOfTime: queryUnitOfTime as moment.unitOfTime.Base,
				currentUnitOfTime: queryUnitOfTime as moment.unitOfTime.Base
			});

			expect(unit).toBe(routeUnitOfTime);
		});

		it('still applies the route unit on the very first emission, when nothing is current yet', () => {
			const unit = selectUnitOfTime({ isNewRouteConfig: true, routeUnitOfTime: 'week' });

			expect(unit).toBe('week');
		});
	});

	describe('staying on a route', () => {
		it('adopts a unit the URL changed to, so a range picked from the menu takes effect', () => {
			// An unlocked reports page: the user clicks "Current Month", the picker writes
			// `unit_of_time=month`, and the same config object comes back around the pipeline.
			const unit = selectUnitOfTime({
				isNewRouteConfig: false,
				routeUnitOfTime: 'week',
				queryUnitOfTime: 'month',
				currentUnitOfTime: 'week'
			});

			expect(unit).toBe('month');
		});

		it('ignores the URL echoing back the unit the picker just wrote', () => {
			// Every write the picker makes comes back as a queryParams emission. Re-applying it
			// would re-derive the range and write again, which is the loop this rule closes.
			const unit = selectUnitOfTime({
				isNewRouteConfig: false,
				routeUnitOfTime: 'week',
				queryUnitOfTime: 'month',
				currentUnitOfTime: 'month'
			});

			expect(unit).toBeNull();
		});

		it('leaves an in-page choice alone when an organization or timezone change re-fires', () => {
			// Same config object, no unit in the URL: nothing has asked for a change, so the month
			// the user picked must not snap back to the route's default week.
			const unit = selectUnitOfTime({
				isNewRouteConfig: false,
				routeUnitOfTime: 'week',
				currentUnitOfTime: 'month'
			});

			expect(unit).toBeNull();
		});

		it('makes no change during the stale window of a route transition', () => {
			// queryParams emits before the new config arrives, pairing the OLD config with the new
			// URL. Deriving here is what wrote a stale unit back into the URL, where it then beat
			// the config that arrived next. Returning null means nothing is written at all.
			const unit = selectUnitOfTime({
				isNewRouteConfig: false,
				routeUnitOfTime: 'week',
				queryUnitOfTime: undefined,
				currentUnitOfTime: 'week'
			});

			expect(unit).toBeNull();
		});
	});
});
