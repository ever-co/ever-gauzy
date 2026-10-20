import '../../../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ICommentCreateInput, ICommentUpdateInput } from '@gauzy/contracts';
import { CommentCreateCommand } from '../comment.create.command';
import { CommentUpdateCommand } from '../comment.update.command';
import { CommentCreateHandler } from './comment.create.handler';
import { CommentUpdateHandler } from './comment.update.handler';

/**
 * The comment handlers rethrew every error as a BadRequestException, so the 403 `CommentService.update` raises
 * for someone else's comment reached the client as a 400. An HTTP error of the service must pass through as is;
 * any other error is still reported as a 400.
 */
describe('Comment command handlers — errors of the service', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const updateWith = (error: Error) =>
		new CommentUpdateHandler({ update: jest.fn().mockRejectedValue(error) } as never).execute(
			new CommentUpdateCommand('comment-1', { comment: 'edited' } as ICommentUpdateInput)
		);

	const createWith = (error: Error) =>
		new CommentCreateHandler({ create: jest.fn().mockRejectedValue(error) } as never).execute(
			new CommentCreateCommand({ comment: 'new' } as ICommentCreateInput)
		);

	it('keeps the 403 of an update of someone else\'s comment', async () => {
		const forbidden = new ForbiddenException(`You don't have permission to update this comment`);

		await expect(updateWith(forbidden)).rejects.toBe(forbidden);
	});

	it('keeps an HTTP error of the creation', async () => {
		const notFound = new NotFoundException('Employee not found');

		await expect(createWith(notFound)).rejects.toBe(notFound);
	});

	it('still reports any other error as a 400', async () => {
		await expect(updateWith(new Error('boom'))).rejects.toBeInstanceOf(BadRequestException);
		await expect(createWith(new Error('boom'))).rejects.toBeInstanceOf(BadRequestException);
	});
});
