import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { TASK_TRASH_SEARCH_MAX_LENGTH, TaskTrashService } from './task-trash.service';

/**
 * Whether a delete may go to the trash is the platform's answer to one read of the trash: a clear answer is kept per
 * organization, and no answer stops the delete (the promise rejects) instead of deleting a task for good.
 */
describe('TaskTrashService', () => {
	let http: { get: jest.Mock };
	let service: TaskTrashService;

	const failure = (status: number) => throwError(() => new HttpErrorResponse({ status }));

	beforeEach(() => {
		http = { get: jest.fn(() => of({ items: [], total: 0 })) };
		service = new TaskTrashService(http as unknown as HttpClient);
	});

	it('reads the trash once per organization: an answer, a 403 too, means the platform keeps one', async () => {
		await expect(service.isEnabled('org-1', 'tenant-1')).resolves.toBe(true);
		await expect(service.isEnabled('org-1', 'tenant-1')).resolves.toBe(true);
		expect(http.get).toHaveBeenCalledTimes(1);
		const params: HttpParams = http.get.mock.calls[0][1].params;
		expect(params.get('organizationId')).toBe('org-1');
		expect(params.get('take')).toBe('1');

		http.get.mockReturnValueOnce(failure(403));
		await expect(service.isEnabled('org-2')).resolves.toBe(true);
	});

	it('remembers 404 (trash off) and 400 (a platform without the route) as no trash', async () => {
		http.get.mockReturnValueOnce(failure(404)).mockReturnValueOnce(failure(400));

		await expect(service.isEnabled('org-off')).resolves.toBe(false);
		await expect(service.isEnabled('org-old')).resolves.toBe(false);
		await expect(service.isEnabled('org-off')).resolves.toBe(false);
		expect(http.get).toHaveBeenCalledTimes(2);
	});

	it('rejects on no answer without remembering it, so the delete stops and the next one asks again', async () => {
		http.get.mockReturnValueOnce(failure(503)).mockReturnValueOnce(failure(0));

		await expect(service.isEnabled('org-flaky')).rejects.toMatchObject({ status: 503 });
		await expect(service.isEnabled('org-flaky')).rejects.toMatchObject({ status: 0 });
		await expect(service.isEnabled('org-flaky')).resolves.toBe(true);
		expect(http.get).toHaveBeenCalledTimes(3);
	});

	it('reads no answer as no trash where it only decides whether to show a link', async () => {
		http.get.mockReturnValueOnce(failure(500));

		await expect(service.isEnabledOrFalse('org-link')).resolves.toBe(false);
		await expect(service.isEnabled(null)).resolves.toBe(false);
	});

	it('keeps a search within the platform’s limit', async () => {
		await service.list({ organizationId: 'org-1', search: `  ${'x'.repeat(250)}  ` });

		const params: HttpParams = http.get.mock.calls[0][1].params;
		expect(params.get('search')).toHaveLength(TASK_TRASH_SEARCH_MAX_LENGTH);
	});
});
