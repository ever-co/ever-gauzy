// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../core/entities/internal';

import { createRandomTimeLogs } from './time-log.seed';

/**
 * With no project holding a task (the task seed found nothing to seed), the time-log seed returned `undefined`, and
 * its caller's activity seed failed on it: "Cannot read properties of undefined (reading 'filter')".
 */
describe('createRandomTimeLogs without a project holding a task', () => {
	it('answers an empty list of slots', async () => {
		const query = {
			alias: 'organization_project',
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([])
		};
		const dataSource = { getRepository: jest.fn(() => ({ createQueryBuilder: jest.fn(() => query) })) };
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);

		await expect(createRandomTimeLogs(dataSource as never, {}, { id: 'tenant-1' } as never, [])).resolves.toEqual(
			[]
		);
	});
});
