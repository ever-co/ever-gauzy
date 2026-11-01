/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import * as fs from 'fs';
import * as path from 'path';
import { lastValueFrom, of } from 'rxjs';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { ReadableCommentsInterceptor } from './readable-comments.interceptor';
import { CommentService } from './comment.service';
import { EmployeeController } from '../employee/employee.controller';
import { OrganizationTeamController } from '../organization-team/organization-team.controller';

/** An HTTP request's execution context, with its parsed query and body. */
const http = (request: { query?: unknown; body?: unknown }) =>
	({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => request }) }) as never;

/**
 * An employee and a team are the records that reach comments (`assignedComments`, filled by a comment's `members` and
 * `teams`), and any route can load them through another record (a project's members' employees, for one). Every route
 * answers those comments by the rules of the comment API's own reads, so a contact's note never reaches a caller who
 * may not read it, and a request that does not name them is answered as before.
 */
describe('ReadableCommentsInterceptor', () => {
	it('is registered for the whole application, after the other global interceptors', () => {
		const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.module.ts'), 'utf8');
		const readableAt = source.indexOf('useClass: ReadableCommentsInterceptor');

		expect(readableAt).toBeGreaterThan(-1);
		expect(source.slice(source.lastIndexOf('provide:', readableAt), readableAt)).toContain('APP_INTERCEPTOR');
		expect(readableAt).toBeGreaterThan(source.indexOf('useClass: IdempotencyInterceptor'));
		expect(readableAt).toBeGreaterThan(source.indexOf('useClass: TransformInterceptor'));
	});

	it.each([
		['EmployeeController', EmployeeController],
		['OrganizationTeamController', OrganizationTeamController]
	])('is not mounted again on %s, which it already covers', (_name, controller) => {
		expect(Reflect.getMetadata(INTERCEPTORS_METADATA, controller) ?? []).not.toContain(ReadableCommentsInterceptor);
	});

	it.each([
		[
			'a project read with its members’ employees’ comments',
			{ query: { relations: ['members.employee.assignedComments'] } }
		],
		['an employee read with its comments', { query: { relations: { assignedComments: 'true' } } }],
		['a read whose JSON parameter names them', { query: { data: '{"relations":["assignedComments"]}' } }],
		['a read whose body names them', { query: {}, body: { relations: ['employee.assignedComments'] } }]
	])('answers what the application’s CommentService keeps of %s', async (_label, request) => {
		const filtered = { id: 'project', members: [] };
		const commentService = { withReadableLoadedComments: jest.fn(async () => filtered) };
		const moduleRef = { get: jest.fn(() => commentService) };
		const interceptor = new ReadableCommentsInterceptor(moduleRef as never);
		const project = {
			id: 'project',
			members: [{ employee: { id: 'employee', assignedComments: [{ id: 'note' }] } }]
		};

		const answer = await lastValueFrom(interceptor.intercept(http(request), { handle: () => of(project) }));

		expect(answer).toBe(filtered);
		expect(commentService.withReadableLoadedComments).toHaveBeenCalledWith(project);
		expect(moduleRef.get).toHaveBeenCalledWith(CommentService, { strict: false });
	});

	it.each([
		[
			'an HTTP request that does not name them',
			http({ query: { relations: ['members.employee.user'] }, body: {} })
		],
		['a GraphQL request, whose types answer no assigned comments', { getType: () => 'graphql' } as never]
	])('answers %s untouched, without looking anything up', async (_label, context) => {
		const moduleRef = { get: jest.fn() };
		const interceptor = new ReadableCommentsInterceptor(moduleRef as never);
		const answer = { id: 'project', members: [] };

		await expect(lastValueFrom(interceptor.intercept(context, { handle: () => of(answer) }))).resolves.toBe(answer);
		expect(moduleRef.get).not.toHaveBeenCalled();
	});

	it('looks the CommentService up once', async () => {
		const commentService = { withReadableLoadedComments: jest.fn(async (answer: unknown) => answer) };
		const moduleRef = { get: jest.fn(() => commentService) };
		const interceptor = new ReadableCommentsInterceptor(moduleRef as never);
		const request = http({ query: { relations: ['assignedComments'] } });

		await lastValueFrom(interceptor.intercept(request, { handle: () => of({ id: 'a' }) }));
		await lastValueFrom(interceptor.intercept(request, { handle: () => of({ id: 'b' }) }));

		expect(moduleRef.get).toHaveBeenCalledTimes(1);
		expect(commentService.withReadableLoadedComments).toHaveBeenCalledTimes(2);
	});

	it('fails the request rather than answer comments unchecked when no CommentService is found', async () => {
		const moduleRef = {
			get: jest.fn(() => {
				throw new Error('CommentService not found');
			})
		};
		const interceptor = new ReadableCommentsInterceptor(moduleRef as never);
		const request = http({ query: { relations: ['assignedComments'] } });

		await expect(
			lastValueFrom(interceptor.intercept(request, { handle: () => of({ id: 'employee-me' }) }))
		).rejects.toThrow('CommentService not found');
	});
});
