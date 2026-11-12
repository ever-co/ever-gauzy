import '../core/entities/internal';

import { HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { TagController } from './tag.controller';

/**
 * `POST /tags` and `PUT /tags/:id` check the name against the tag's scope before writing (ever-co/ever-teams#5016):
 * a create with a taken name writes nothing, and a change is checked against the stored tag before the write.
 */
describe('TagController names', () => {
	const organizationId = 'organization-1';
	const taken = new ApiException(HttpStatus.CONFLICT, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'taken', {
		field: 'name'
	});

	function controllerWith(existing?: Record<string, unknown>) {
		const tagService = {
			assertNameIsFree: jest.fn(async () => undefined),
			assertChangeIsFree: jest.fn(async () => undefined),
			assertRecoveryIsFree: jest.fn(async () => undefined),
			softRecover: jest.fn(async (id: string) => ({ id })),
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

	it('checks a change against the stored tag before it writes, and writes nothing when the name is taken', async () => {
		const existing = { id: 'tag-1', name: 'Bug', organizationId, organizationTeamId: 'team-1' };
		const { controller, tagService } = controllerWith(existing);
		const changes = { name: 'Feature', organizationTeamId: 'team-2' };

		await controller.update('tag-1', changes as never);
		expect(tagService.findOneByIdString).toHaveBeenCalledWith('tag-1');
		expect(tagService.assertChangeIsFree).toHaveBeenCalledWith(existing, changes, 'tag-1');
		expect(tagService.update).toHaveBeenCalledWith('tag-1', changes);

		tagService.update.mockClear();
		tagService.assertChangeIsFree.mockRejectedValueOnce(taken);
		await expect(controller.update('tag-1', { name: 'Feature' } as never)).rejects.toBe(taken);
		expect(tagService.update).not.toHaveBeenCalled();
	});

	it('checks a recovery before it brings the tag back, and recovers nothing when the name is taken', async () => {
		const { controller, tagService } = controllerWith();

		await controller.softRecover('tag-1');
		expect(tagService.assertRecoveryIsFree).toHaveBeenCalledWith('tag-1');
		expect(tagService.softRecover).toHaveBeenCalledWith('tag-1', []);

		tagService.softRecover.mockClear();
		tagService.assertRecoveryIsFree.mockRejectedValueOnce(taken);
		await expect(controller.softRecover('tag-1')).rejects.toBe(taken);
		expect(tagService.softRecover).not.toHaveBeenCalled();
	});
});
