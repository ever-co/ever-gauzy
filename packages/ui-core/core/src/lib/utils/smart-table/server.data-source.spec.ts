import { HttpClient, HttpResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { ServerDataSource } from './server.data-source';

/** An answer of the list endpoints: the rows under `items`, their count under `total`. */
const answer = (items: unknown[]) => new HttpResponse({ body: { items, total: items.length } });

describe('ServerDataSource', () => {
	it('keeps the answer to the last request when an older request answers after it', async () => {
		const answers = [new Subject<HttpResponse<unknown>>(), new Subject<HttpResponse<unknown>>()];
		let sent = 0;
		const http = { get: jest.fn(() => answers[sent++].asObservable()) };
		const finalize = jest.fn();
		const source = new ServerDataSource(http as unknown as HttpClient, { endPoint: '/api/tasks', finalize });

		const older = source.getElements();
		const newer = source.getElements();
		answers[1].next(answer([{ id: 'after the save' }]));
		answers[1].complete();
		await newer;
		answers[0].next(answer([{ id: 'before the save' }, { id: 'another' }]));
		answers[0].complete();
		await older;

		expect(source.getData()).toEqual([{ id: 'after the save' }]);
		expect(source.count()).toBe(1);
		// Only the last request tells the page it is done.
		expect(finalize).toHaveBeenCalledTimes(1);
	});

	it('hands the error of a failed read to finalize, and keeps the previous answer', async () => {
		const failure = new Error('API unreachable');
		const http = {
			get: jest
				.fn()
				.mockReturnValueOnce(of(answer([{ id: 'shown' }])))
				.mockReturnValueOnce(throwError(() => failure))
		};
		const finalize = jest.fn();
		const source = new ServerDataSource(http as unknown as HttpClient, { endPoint: '/api/tasks', finalize });

		await source.getElements();
		await expect(source.getElements()).rejects.toThrow();

		expect(finalize).toHaveBeenNthCalledWith(1);
		expect(finalize).toHaveBeenNthCalledWith(2, failure);
		expect(source.getData()).toEqual([{ id: 'shown' }]);
	});
});
