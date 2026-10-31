import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { ITimeOff, StatusTypesEnum } from '@gauzy/contracts';
import { TimeOffComponent } from './time-off.component';

/**
 * Approve / Deny on the time-off page when the server refuses the change. Since ever-co/ever-gauzy#10183 an approval
 * takes the leave's working days from the employee's balance, and one the balance cannot cover is refused with a
 * 400 that says so. The page used to show only "Unable to set time off request status." and kept the row marked
 * with the status it had asked for, so a second click reported "no changes" without asking the server again.
 *
 * The real methods run on a bare instance: no template or DI is needed.
 */
describe('TimeOffComponent status refusals', () => {
	const INSUFFICIENT = 'Insufficient leave balance for the requested number of days';

	const setup = (answer: 'ok' | HttpErrorResponse, status: StatusTypesEnum = StatusTypesEnum.REQUESTED) => {
		const record = { id: 'leave-1', status } as ITimeOff;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(TimeOffComponent.prototype);
		Object.assign(component, {
			selectedTimeOffRecord: record,
			_timeOffService: {
				updateRequestStatus: jest.fn(() => (answer === 'ok' ? of({}) : throwError(() => answer)))
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
		expect(component._toastrService.danger).toHaveBeenCalledWith(error, 'TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS');
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

		expect(component._toastrService.success).toHaveBeenCalledWith('TIME_OFF_PAGE.NOTIFICATIONS.STATUS_SET_APPROVED');
		expect(component._toastrService.danger).not.toHaveBeenCalled();
		expect(record.status).toBe(StatusTypesEnum.APPROVED);
	});
});
