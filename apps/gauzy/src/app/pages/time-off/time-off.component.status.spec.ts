import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ITimeOff, StatusTypesEnum } from '@gauzy/contracts';
import { TimeOffComponent } from './time-off.component';

/**
 * Approve / Deny on the time-off page when the server refuses the change. Since ever-co/ever-gauzy#10183 an approval
 * takes the leave's working days from the employee's balance, and under a policy that requires a sufficient balance,
 * one the balance cannot cover is refused with a 400 that says so. The page used to show only "Unable to set time
 * off request status." and kept the row marked with the status it had asked for, so a second click reported
 * "no changes" without asking the server again.
 *
 * The real methods run on a bare instance: no template or DI is needed.
 */
describe('TimeOffComponent status refusals', () => {
	const INSUFFICIENT = 'Insufficient leave balance for the requested number of days';

	const setup = (
		answer: 'ok' | HttpErrorResponse | Observable<unknown>,
		status: StatusTypesEnum = StatusTypesEnum.REQUESTED
	) => {
		const record = { id: 'leave-1', status } as ITimeOff;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(TimeOffComponent.prototype);
		Object.assign(component, {
			selectedTimeOffRecord: record,
			_statusChangesInFlight: new Set(),
			_timeOffService: {
				updateRequestStatus: jest.fn(() =>
					answer === 'ok' ? of({}) : answer instanceof Observable ? answer : throwError(() => answer)
				)
			},
			_toastrService: { success: jest.fn(), danger: jest.fn() },
			_refresh$: new Subject<boolean>(),
			timeOff$: new Subject<boolean>()
		});
		return { component, record };
	};

	const refusal = (status: number, message: string) =>
		new HttpErrorResponse({ status, error: { statusCode: status, message } });

	it('shows why an approval was refused, and keeps the row as the server has it', () => {
		const error = refusal(400, INSUFFICIENT);
		const { component, record } = setup(error);

		component.approveDaysOff();

		expect(component._timeOffService.updateRequestStatus).toHaveBeenCalledWith('leave-1', 'approval');
		expect(component._toastrService.danger).toHaveBeenCalledWith(
			error,
			'TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS'
		);
		expect(record.status).toBe(StatusTypesEnum.REQUESTED);
	});

	it('asks the server again on a second click after a refusal', () => {
		const { component } = setup(refusal(400, INSUFFICIENT));

		component.approveDaysOff();
		component.approveDaysOff();

		expect(component._timeOffService.updateRequestStatus).toHaveBeenCalledTimes(2);
		expect(component._toastrService.success).not.toHaveBeenCalled();
	});

	it('keeps the generic notice for an error the server does not explain', () => {
		const { component, record } = setup(refusal(500, 'Internal server error'), StatusTypesEnum.APPROVED);

		component.denyDaysOff();

		expect(component._timeOffService.updateRequestStatus).toHaveBeenCalledWith('leave-1', 'denied');
		expect(component._toastrService.danger).toHaveBeenCalledWith('TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS');
		expect(record.status).toBe(StatusTypesEnum.APPROVED);
	});

	it('keeps the new status when the server accepts it', () => {
		const { component, record } = setup('ok');

		component.approveDaysOff();

		expect(component._toastrService.success).toHaveBeenCalledWith(
			'TIME_OFF_PAGE.NOTIFICATIONS.STATUS_SET_APPROVED'
		);
		expect(component._toastrService.danger).not.toHaveBeenCalled();
		expect(record.status).toBe(StatusTypesEnum.APPROVED);
		expect(component._statusChangesInFlight.size).toBe(0);
	});

	it('ignores Deny while the Approve for the same request is on its way, so a refusal restores the real status', () => {
		const answer = new Subject<unknown>();
		const { component, record } = setup(answer);

		component.approveDaysOff();
		component.denyDaysOff();

		expect(component._timeOffService.updateRequestStatus).toHaveBeenCalledTimes(1);
		expect(record.status).toBe(StatusTypesEnum.APPROVED);

		answer.error(refusal(400, INSUFFICIENT));

		expect(record.status).toBe(StatusTypesEnum.REQUESTED);
		expect(component._statusChangesInFlight.size).toBe(0);
	});

	it('takes the next click once the answer is in', () => {
		const answer = new Subject<unknown>();
		const { component } = setup(answer);

		component.approveDaysOff();
		answer.next({});
		answer.complete();
		component.denyDaysOff();

		expect(component._timeOffService.updateRequestStatus.mock.calls).toEqual([
			['leave-1', 'approval'],
			['leave-1', 'denied']
		]);
	});
});

/** The request's document link in the Description column opens through the shared safe opener's check. */
describe('TimeOffComponent.mapTimeOffRequest document link', () => {
	const map = (documentUrl: string | undefined) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(TimeOffComponent.prototype);
		component.getTranslation = (key: string) => key;
		const timeOff = {
			documentUrl,
			description: 'Family trip',
			status: StatusTypesEnum.REQUESTED,
			employees: [{ fullName: 'Ada Lovelace', user: { imageUrl: 'ada.png' } }]
		} as unknown as ITimeOff;
		return component.mapTimeOffRequest(timeOff).extendedDescription as string;
	};

	it('links an http(s) document, quoted, opened without access to this page', () => {
		expect(map('https://files.test/forms/leave.pdf?a=1&b=2')).toBe(
			'<a href="https://files.test/forms/leave.pdf?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">' +
				'TIME_OFF_PAGE.VIEW_REQUEST_DOCUMENT</a><br>Family trip'
		);
	});

	it('keeps quotes in a link from closing the attribute', () => {
		expect(map('https://files.test/a.pdf" onmouseover="x')).toContain(
			'href="https://files.test/a.pdf%22%20onmouseover=%22x"'
		);
	});

	it.each([['javascript:alert(1)'], ['data:text/html,hi'], [''], [undefined]])(
		'shows only the description for %p',
		(documentUrl) => {
			expect(map(documentUrl)).toBe('Family trip');
		}
	);
});
