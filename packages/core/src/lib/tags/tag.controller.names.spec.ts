import '../core/entities/internal';

import { HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { TagController } from './tag.controller';

/**
 * `POST /tags` and `PUT /tags/:id` check the name against the tag's scope before writing (ever-co/ever-teams#5016):
 * a create with a taken name writes nothing, and a rename is checked in the scope the tag will have after it.
 */
describe('TagController names', () => {
	const organizationId = 'organization-1';
	const taken = new ApiException(HttpStatus.CONFLICT, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'taken', {
		field: 'name'
	});

	function controllerWith(existing?: Record<string, unknown>) {
		const tagService = {
			assertNameIsFree: jest.fn(async () => undefined),
			create: jest.fn(async (body: Record<string, unknown>) => ({ id: 'tag-new', ...body })),
			update: jest.fn(async () => ({ affected: 1 })),
			findOneByIdString: jest.fn(async () => existing)
		};
		return { tagService, controller: new TagController(tagService as never, {} as never, {} as never) };
	}

	it('checks the name before it creates, and writes nothing when the name is taken', async () => {
		const { controller, tagService } = controllerWith();
		const body = { name: 'Bug', color: '#D73A4A', organizationId, organizationTeamId: 'team-1' };

		await controller.create(body as never);
		expect(tagService.assertNameIsFree).toHaveBeenCalledWith(body);
		expect(tagService.create).toHaveBeenCalledWith(body);

		tagService.create.mockClear();
		tagService.assertNameIsFree.mockRejectedValueOnce(taken);
		await expect(controller.create(body as never)).rejects.toBe(taken);
		expect(tagService.create).not.toHaveBeenCalled();
	});

	it('checks a rename, or a move to another team, in the scope the tag will have, leaving the tag itself out', async () => {
		const existing = { id: 'tag-1', name: 'Bug', organizationId, organizationTeamId: 'team-1' };
		const { controller, tagService } = controllerWith(existing);

		await controller.update('tag-1', { color: '#000000' } as never);
		expect(tagService.assertNameIsFree).toHaveBeenLastCalledWith(
			{ name: 'Bug', organizationId, organizationTeamId: 'team-1' },
			'tag-1'
		);

		await controller.update('tag-1', { name: 'Feature', organizationTeamId: 'team-2' } as never);
		expect(tagService.assertNameIsFree).toHaveBeenLastCalledWith(
			{ name: 'Feature', organizationId, organizationTeamId: 'team-2' },
			'tag-1'
		);

		tagService.update.mockClear();
		tagService.assertNameIsFree.mockRejectedValueOnce(taken);
		await expect(controller.update('tag-1', { name: 'Feature' } as never)).rejects.toBe(taken);
		expect(tagService.update).not.toHaveBeenCalled();
	});
});
