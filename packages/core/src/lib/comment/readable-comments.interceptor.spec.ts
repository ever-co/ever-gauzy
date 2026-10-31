/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { lastValueFrom, of } from 'rxjs';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { ReadableCommentsInterceptor } from './readable-comments.interceptor';
import { CommentService } from './comment.service';
import { EmployeeController } from '../employee/employee.controller';
import { OrganizationTeamController } from '../organization-team/organization-team.controller';

/**
 * An employee and a team are the records that reach comments (`assignedComments`, filled by a comment's `members` and
 * `teams`). Every route of theirs answers those comments by the rules of the comment API's own reads, so a contact's
 * note never reaches a caller who may not read it through `GET /employee/:id?relations[]=assignedComments` or a team.
 */
describe('ReadableCommentsInterceptor', () => {
	it.each([
		['EmployeeController', EmployeeController],
		['OrganizationTeamController', OrganizationTeamController]
	])('is mounted on %s', (_name, controller) => {
		expect(Reflect.getMetadata(INTERCEPTORS_METADATA, controller)).toContain(ReadableCommentsInterceptor);
	});

	it('answers what the application’s CommentService keeps of the route’s answer', async () => {
		const filtered = { id: 'employee-me', assignedComments: [] };
		const commentService = { withReadableLoadedComments: jest.fn(async () => filtered) };
		const moduleRef = { get: jest.fn(() => commentService) };
		const interceptor = new ReadableCommentsInterceptor(moduleRef as never);
		const employee = { id: 'employee-me', assignedComments: [{ id: 'note' }] };

		const answer = await lastValueFrom(interceptor.intercept({} as never, { handle: () => of(employee) }));

		expect(answer).toBe(filtered);
		expect(commentService.withReadableLoadedComments).toHaveBeenCalledWith(employee);
		expect(moduleRef.get).toHaveBeenCalledWith(CommentService, { strict: false });
	});

	it('looks the CommentService up once', async () => {
		const commentService = { withReadableLoadedComments: jest.fn(async (answer: unknown) => answer) };
		const moduleRef = { get: jest.fn(() => commentService) };
		const interceptor = new ReadableCommentsInterceptor(moduleRef as never);

		await lastValueFrom(interceptor.intercept({} as never, { handle: () => of({ id: 'a' }) }));
		await lastValueFrom(interceptor.intercept({} as never, { handle: () => of({ id: 'b' }) }));

		expect(moduleRef.get).toHaveBeenCalledTimes(1);
		expect(commentService.withReadableLoadedComments).toHaveBeenCalledTimes(2);
	});

	it('fails the route rather than answer comments unchecked when no CommentService is found', async () => {
		const moduleRef = {
			get: jest.fn(() => {
				throw new Error('CommentService not found');
			})
		};
		const interceptor = new ReadableCommentsInterceptor(moduleRef as never);

		await expect(
			lastValueFrom(interceptor.intercept({} as never, { handle: () => of({ id: 'employee-me' }) }))
		).rejects.toThrow('CommentService not found');
	});
});
