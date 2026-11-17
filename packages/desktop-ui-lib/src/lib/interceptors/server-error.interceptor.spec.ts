import { HttpContext, HttpErrorResponse, HttpHandler, HttpRequest } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { ServerErrorInterceptor } from './server-error.interceptor';
import { SKIP_NOT_FOUND_NOTIFICATION } from './skip-not-found-notification.token';

/**
 * A lookup whose caller takes a 404 for "deleted" (the desktop timer's time log and time slot lookups) marks its
 * request with `SKIP_NOT_FOUND_NOTIFICATION`: its 404 shows no error toast, any other error of it still does.
 */
describe('ServerErrorInterceptor', () => {
	const errorHandler = { handleError: jest.fn() };
	const electron = { ipcRenderer: { send: jest.fn() } };
	let interceptor: ServerErrorInterceptor;

	beforeEach(() => {
		jest.clearAllMocks();
		const store = { isOffline: false };
		interceptor = new ServerErrorInterceptor(errorHandler as never, electron as never, store as never);
	});

	const failingWith = (status: number) => {
		const error = new HttpErrorResponse({ status, statusText: String(status), error: { statusCode: status } });
		return { error, next: { handle: jest.fn(() => throwError(() => error)) } as unknown as HttpHandler };
	};

	const lookup = (marked: boolean) =>
		new HttpRequest('GET', '/api/timesheet/time-log/gone', {
			context: marked ? new HttpContext().set(SKIP_NOT_FOUND_NOTIFICATION, true) : new HttpContext()
		});

	it('shows no error toast for the 404 of a marked request, and hands the 404 to the caller', async () => {
		const { error, next } = failingWith(404);

		await expect(firstValueFrom(interceptor.intercept(lookup(true), next))).rejects.toBe(error);

		expect(errorHandler.handleError).not.toHaveBeenCalled();
	});

	it('still shows any other error of a marked request', async () => {
		const { error, next } = failingWith(403);

		await expect(firstValueFrom(interceptor.intercept(lookup(true), next))).rejects.toBe(error);

		expect(errorHandler.handleError).toHaveBeenCalledWith(error);
	});

	it('still shows the 404 of an unmarked request', async () => {
		const { error, next } = failingWith(404);

		await expect(firstValueFrom(interceptor.intercept(lookup(false), next))).rejects.toBe(error);

		expect(errorHandler.handleError).toHaveBeenCalledWith(error);
	});
});
