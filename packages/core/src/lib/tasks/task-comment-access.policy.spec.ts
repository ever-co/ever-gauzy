import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseEntityEnum, PermissionsEnum } from '@gauzy/contracts';
import { COMMENT_PARENT_ACCESS_POLICY } from '../comment/parent-access';
import { TaskCommentAccessPolicy } from './task-comment-access.policy';

const TASK_ID = '2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091';

describe('TaskCommentAccessPolicy', () => {
	const policyOver = (findOneByIdString: jest.Mock) => new TaskCommentAccessPolicy({ findOneByIdString } as never);

	it('opens a task’s comments to whoever the task reads admit, and governs nothing else', () => {
		const policy = policyOver(jest.fn());

		expect(new Reflector().get(COMMENT_PARENT_ACCESS_POLICY, TaskCommentAccessPolicy)).toBe(true);
		expect(policy.entity).toBe(BaseEntityEnum.Task);
		expect(policy.opensReadsOnly).toBe(true);
		expect(policy.readPermissions).toEqual([PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW]);
	});

	it('answers the task the task read finds, in its organization', async () => {
		const findOneByIdString = jest.fn().mockResolvedValue({ id: TASK_ID, organizationId: 'organization-1' });

		await expect(policyOver(findOneByIdString).findAccessibleParent(TASK_ID)).resolves.toEqual({
			id: TASK_ID,
			organizationId: 'organization-1'
		});
		expect(findOneByIdString).toHaveBeenCalledWith(TASK_ID);
	});

	it('answers null for a task the task read does not find: another organization’s, or none', async () => {
		const findOneByIdString = jest
			.fn()
			.mockRejectedValue(new NotFoundException('The requested record was not found'));

		await expect(policyOver(findOneByIdString).findAccessibleParent(TASK_ID)).resolves.toBeNull();
	});

	it('lets any other failure of the task read through, so the comment read fails rather than guesses', async () => {
		const findOneByIdString = jest.fn().mockRejectedValue(new ForbiddenException());

		await expect(policyOver(findOneByIdString).findAccessibleParent(TASK_ID)).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});
});
