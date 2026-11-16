import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { HIDDEN_PROJECT_ROWS, HiddenProjectsInterceptor } from './hidden-projects.interceptor';

/**
 * CORE-27 (ever-co/ever-gauzy#12031): the routes that answer time entries, reports, tasks and the timer status answer a
 * project the caller may not see as its id and `projectHidden`, the hidden projects being read once per request.
 */

const CONFIDENTIAL = 'project-client-x-redesign';

describe('HiddenProjectsInterceptor', () => {
	let hiddenProjects: jest.Mock;
	let metadata: Record<string, unknown>;
	let interceptor: HiddenProjectsInterceptor;
	const handler = (): void => undefined;
	class Controller {}
	const context = { getHandler: () => handler, getClass: () => Controller } as unknown as ExecutionContext;
	const answering = (answer: unknown): CallHandler => ({ handle: () => of(answer) });

	beforeEach(() => {
		metadata = {};
		hiddenProjects = jest.fn().mockResolvedValue(new Map([[CONFIDENTIAL, 'Client X redesign']]));
		const moduleRef = { get: jest.fn().mockReturnValue({ hiddenProjects }) } as unknown as ModuleRef;
		const reflector = {
			getAllAndOverride: jest.fn((key: string) => metadata[key])
		} as unknown as Reflector;
		interceptor = new HiddenProjectsInterceptor(moduleRef, reflector);
	});

	it('answers a hidden project of a daily report row as its id and the marker, the time staying', async () => {
		const report = [
			{
				date: '2026-11-09',
				logs: [{ project: { id: CONFIDENTIAL, name: 'Client X redesign' }, sum: 43200 }]
			}
		];

		const answer = await lastValueFrom(interceptor.intercept(context, answering(report)));

		expect(answer).toEqual([
			{ date: '2026-11-09', logs: [{ project: { id: CONFIDENTIAL, projectHidden: true }, sum: 43200 }] }
		]);
		expect(hiddenProjects).toHaveBeenCalledTimes(1);
	});

	it('answers as the route did where nothing is hidden', async () => {
		hiddenProjects.mockResolvedValue(new Map());
		const report = [{ logs: [{ project: { id: CONFIDENTIAL, name: 'Client X redesign' } }] }];

		expect(await lastValueFrom(interceptor.intercept(context, answering(report)))).toBe(report);
	});

	it('reads nothing for an answer without anything to walk', async () => {
		expect(await lastValueFrom(interceptor.intercept(context, answering(42)))).toBe(42);
		expect(await lastValueFrom(interceptor.intercept(context, answering(null)))).toBeNull();
		expect(hiddenProjects).not.toHaveBeenCalled();
	});

	it('reads how the route names its projects from the route', async () => {
		metadata[HIDDEN_PROJECT_ROWS] = { rootRowsAreProjects: { keep: ['duration'] } };
		const statistics = [{ id: CONFIDENTIAL, name: 'Client X redesign', duration: 43200 }];

		expect(await lastValueFrom(interceptor.intercept(context, answering(statistics)))).toEqual([
			{ id: CONFIDENTIAL, projectHidden: true, duration: 43200 }
		]);
	});
});
