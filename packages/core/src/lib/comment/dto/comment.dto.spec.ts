/**
 * 🛑 This import must stay FIRST, before any import that pulls a core entity — see `channel.controller.spec.ts`
 * for the cycle it avoids.
 */
import '../../core/entities/internal';

import { ValidationPipe } from '@nestjs/common';
import { BaseEntityEnum } from '@gauzy/contracts';
import { CreateCommentDTO } from './create-comment.dto';
import { UpdateCommentDTO } from './update-comment.dto';

/**
 * A comment's `members` and `teams` fill the `assignedComments` an employee's and a team's reads answer. The REST
 * create and update routes run their DTO under `whitelist: true`, and neither DTO declares the two relations, so a
 * body never stores them through `POST /comment` or `PUT /comment/:id` (nor through GraphQL, whose inputs do not
 * declare them either). `CommentService` leaves them out of a governed record's comment as well, whoever calls it.
 */
describe('Comment REST DTOs — a body cannot assign a comment to employees or teams', () => {
	// As `CommentController.create` and `CommentController.update` run it.
	const pipe = new ValidationPipe({ whitelist: true });
	const body = {
		comment: 'Called them, they want a quote by Friday',
		entity: BaseEntityEnum.OrganizationContact,
		entityId: '6d7c4a3e-1b2f-4c5d-8e9f-0a1b2c3d4e5f',
		// Stands in for the organization, whose membership check needs a repository.
		sentTo: 'organization-of-contact',
		members: [{ id: '0a1b2c3d-4e5f-4061-8728-394a5b6c7d8e' }],
		teams: [{ id: '1b2c3d4e-5f60-4172-8839-4a5b6c7d8e9f' }]
	};

	it.each([
		['CreateCommentDTO', CreateCommentDTO],
		['UpdateCommentDTO', UpdateCommentDTO]
	])('%s drops members and teams and keeps the comment', async (_name, metatype) => {
		const value = await pipe.transform({ ...body }, { type: 'body', metatype, data: '' });

		expect(value).toEqual(expect.objectContaining({ comment: body.comment }));
		expect(value).not.toHaveProperty('members');
		expect(value).not.toHaveProperty('teams');
	});
});
