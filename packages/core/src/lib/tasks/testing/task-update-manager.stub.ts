/**
 * A stand-in for the TypeORM manager `TaskService.update` writes through, for the specs that build the service by
 * hand (`Object.create(TaskService.prototype)`). The update runs its writes in one transaction
 * (`inUpdateTransaction`): `transaction` runs the work at once, on this same manager, and `getRepository` hands out
 * one repository per entity, whose `save` a spec reads with `saves(Entity)` (the sprint move history, the former
 * reference of a moved task). The locked read of the task's reference (`createQueryBuilder`) answers `lockedRow`
 * (none by default: the task as read before stands). Members of `base` (`findOne`, `find`, …) are kept, and win.
 */
export function stubTaskUpdateManager(base: Record<string, unknown> = {}, lockedRow: Record<string, unknown> | null = null) {
	const lockedRead: Record<string, jest.Mock> = {};
	for (const step of ['select', 'where', 'setLock']) {
		lockedRead[step] = jest.fn(() => lockedRead);
	}
	lockedRead.getOne = jest.fn(async () => lockedRow);
	const repositories = new Map<unknown, { save: jest.Mock; delete: jest.Mock }>();
	const repositoryOf = (entity: unknown) => {
		let repository = repositories.get(entity);
		if (!repository) {
			repository = { save: jest.fn(async (row: unknown) => row), delete: jest.fn(async () => ({ affected: 1 })) };
			repositories.set(entity, repository);
		}
		return repository;
	};
	const manager: Record<string, unknown> = {
		getRepository: jest.fn((entity: unknown) => repositoryOf(entity)),
		transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => work(manager)),
		createQueryBuilder: jest.fn(() => lockedRead),
		...base
	};
	return {
		manager,
		/** The locked read of the task's reference: `setLock` tells whether it locked the row. */
		lockedRead,
		/** The `save` of the repository of `entity` (the same mock on every call). */
		saves: (entity: unknown): jest.Mock => repositoryOf(entity).save
	};
}
