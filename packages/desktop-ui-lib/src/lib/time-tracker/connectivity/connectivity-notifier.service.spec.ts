import { TranslateService } from '@ngx-translate/core';
import { ToastrNotificationService } from '../../services/toastr-notification.service';
import { CONNECTIVITY_NOTICE_KEYS } from './connectivity-notice';
import { ConnectivityNotifierService } from './connectivity-notifier.service';

/**
 * The toasts of a connectivity change (#8415): a warning that stays while offline (until clicked or until the
 * connection is back), a success toast when back online, nothing when the state did not change.
 */
describe('ConnectivityNotifierService', () => {
	let toastr: { warn: jest.Mock; success: jest.Mock };
	let offlineToast: { close: jest.Mock };
	let service: ConnectivityNotifierService;

	beforeEach(() => {
		offlineToast = { close: jest.fn() };
		toastr = { warn: jest.fn(() => offlineToast), success: jest.fn() };
		const translate = {
			instant: jest.fn((key: string, params?: { count: number }) => (params ? `${key}:${params.count}` : key))
		};
		service = new ConnectivityNotifierService(
			toastr as unknown as ToastrNotificationService,
			translate as unknown as TranslateService
		);
	});

	it('shows an offline warning that stays until clicked', () => {
		service.notify(false, true);

		expect(toastr.warn).toHaveBeenCalledWith(CONNECTIVITY_NOTICE_KEYS.LOST, { duration: 0 });
		expect(toastr.success).not.toHaveBeenCalled();
	});

	it('closes the offline warning and says so when the connection is back', () => {
		service.notify(false, true);
		service.notify(true, false, 2);

		expect(offlineToast.close).toHaveBeenCalledTimes(1);
		expect(toastr.success).toHaveBeenCalledWith(`${CONNECTIVITY_NOTICE_KEYS.RESTORED_SYNCING}:2`);
	});

	it('does nothing when the state did not change', () => {
		service.notify(false, false);
		service.notify(true, true);

		expect(toastr.warn).not.toHaveBeenCalled();
		expect(toastr.success).not.toHaveBeenCalled();
	});

	it('keeps at most one offline warning on a flapping connection', () => {
		const toasts = [{ close: jest.fn() }, { close: jest.fn() }];
		toastr.warn.mockReturnValueOnce(toasts[0]).mockReturnValueOnce(toasts[1]);

		service.notify(false, true);
		service.notify(true, false);
		service.notify(false, true);

		expect(toasts[0].close).toHaveBeenCalledTimes(1);
		expect(toasts[1].close).not.toHaveBeenCalled();
	});

	it('copes with a warning the toastr did not open (a duplicate it prevented)', () => {
		toastr.warn.mockReturnValueOnce(undefined);

		service.notify(false, true);

		expect(() => service.notify(true, false)).not.toThrow();
	});
});
