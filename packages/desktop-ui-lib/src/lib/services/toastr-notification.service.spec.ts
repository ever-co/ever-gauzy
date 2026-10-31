import { NbToastrService } from '@nebular/theme';
import { ToastrNotificationService } from './toastr-notification.service';

/**
 * The app's toasts keep their defaults (title, no duplicates), take an optional Nebular config over them, and
 * answer the toast's reference so a caller can close it (the offline notice of #8415 does).
 */
describe('ToastrNotificationService', () => {
	const ref = { close: jest.fn() };
	let toastr: Record<'success' | 'danger' | 'warning' | 'info', jest.Mock>;
	let service: ToastrNotificationService;

	beforeEach(() => {
		toastr = {
			success: jest.fn(() => ref),
			danger: jest.fn(() => ref),
			warning: jest.fn(() => ref),
			info: jest.fn(() => ref)
		};
		service = new ToastrNotificationService(toastr as unknown as NbToastrService, { DESCRIPTION: 'Gauzy Timer' });
	});

	it('keeps the defaults when no config is given', () => {
		service.success('saved');
		service.warn('careful');

		expect(toastr.success).toHaveBeenCalledWith('saved', 'Gauzy Timer', {
			toastClass: 'toast-top-custom-title-bar',
			preventDuplicates: true
		});
		expect(toastr.warning).toHaveBeenCalledWith('careful', 'Gauzy Timer', { preventDuplicates: true });
	});

	it('merges a given config over the defaults and answers the toast', () => {
		expect(service.warn('offline', { duration: 0 })).toBe(ref);
		expect(toastr.warning).toHaveBeenCalledWith('offline', 'Gauzy Timer', { preventDuplicates: true, duration: 0 });

		expect(service.error('failed', { preventDuplicates: false })).toBe(ref);
		expect(toastr.danger).toHaveBeenCalledWith('failed', 'Gauzy Timer', { preventDuplicates: false });

		expect(service.info('note', { duration: 1000 })).toBe(ref);
		expect(toastr.info).toHaveBeenCalledWith('note', 'Gauzy Timer', { preventDuplicates: true, duration: 1000 });
	});

	it('falls back to the Gauzy title without an environment', () => {
		new ToastrNotificationService(toastr as unknown as NbToastrService, null).info('hello');

		expect(toastr.info).toHaveBeenCalledWith('hello', 'Gauzy', { preventDuplicates: true });
	});
});
