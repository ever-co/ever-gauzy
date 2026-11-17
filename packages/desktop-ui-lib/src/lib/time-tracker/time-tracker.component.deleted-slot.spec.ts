import { BehaviorSubject, Subject } from 'rxjs';
import { TimeTrackerComponent } from './time-tracker.component';

/**
 * Refreshing the timer asks the server for the time slot of the last capture. When that time slot was deleted (from
 * another place, or straight from the database) the lookup answers "not there", which is not a failure to report.
 *
 * The component's method runs on its prototype with the fields it uses, without rendering the template.
 */
describe('TimeTrackerComponent.getLastTimeSlotImage, last time slot deleted', () => {
	const getTimeSlot = jest.fn();
	const handleError = jest.fn();
	let component: TimeTrackerComponent;

	beforeEach(() => {
		jest.clearAllMocks();
		localStorage.setItem('lastScreenCapture', '{"recordedAt":"2026-01-01"}');
		component = Object.create(TimeTrackerComponent.prototype);
		Object.assign(component, {
			electronService: { invoke: jest.fn().mockResolvedValue({ timeSlotId: 'deleted-slot' }) },
			timeTrackerService: { getTimeSlot },
			_errorHandlerService: { handleError },
			_isOffline$: new BehaviorSubject(false),
			_captureGeneration: 0,
			_remoteLastTimeSlot$: null,
			lastTimeSlot: { id: 'deleted-slot' },
			screenshots$: new Subject(),
			lastScreenCapture$: new BehaviorSubject({ recordedAt: '2026-01-01' })
		});
	});

	it('shows no error and clears the screenshot of the deleted time slot', async () => {
		getTimeSlot.mockResolvedValue(null);

		await component.getLastTimeSlotImage({});

		expect(getTimeSlot).toHaveBeenCalledWith({ timeSlotId: 'deleted-slot' });
		expect(handleError).not.toHaveBeenCalled();
		expect(localStorage.getItem('lastScreenCapture')).toBeNull();
		expect(component.lastTimeSlot).toBeNull();
	});

	it('keeps a capture that landed while the lookup of the deleted one was pending', async () => {
		const newer = { recordedAt: '2026-01-01T00:10:00Z' };
		getTimeSlot.mockImplementation(async () => {
			// The next capture lands (`last_capture_local`) while the lookup of the deleted one is on its way.
			component['_captureGeneration']++;
			component.lastScreenCapture$.next(newer);
			localStorage.setItem('lastScreenCapture', JSON.stringify(newer));
			return null;
		});

		await component.getLastTimeSlotImage({});

		expect(handleError).not.toHaveBeenCalled();
		expect(component.lastScreenCapture).toBe(newer);
		expect(localStorage.getItem('lastScreenCapture')).toBe(JSON.stringify(newer));
	});

	it('still reports any other failure, and keeps what is on screen', async () => {
		const failure = Object.assign(new Error('Internal Server Error'), { status: 500 });
		getTimeSlot.mockRejectedValue(failure);

		await component.getLastTimeSlotImage({});

		expect(handleError).toHaveBeenCalledWith(failure);
		expect(localStorage.getItem('lastScreenCapture')).not.toBeNull();
	});
});
