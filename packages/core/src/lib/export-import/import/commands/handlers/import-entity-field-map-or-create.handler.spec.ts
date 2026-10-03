import 'reflect-metadata';

jest.mock('./../../../../core', () => ({
	RequestContext: { currentTenantId: () => 'a0000000-0000-4000-8000-00000000000a' }
}));
jest.mock('./../../../import-record', () => ({
	ImportRecordFindOrFailCommand: class ImportRecordFindOrFailCommand {
		constructor(public readonly input: unknown) {}
	}
}));

import { ExportRedacted, OPAQUE_EXPORT_MASK } from '../../../export-redact.decorator';
import { ImportEntityFieldMapOrCreateCommand } from '../import-entity-field-map-or-create.command';
import { ImportEntityFieldMapOrCreateHandler } from './import-entity-field-map-or-create.handler';

/** Stand-in for an entity with the three kinds of redaction mark an archive can carry. */
class Account {
	name: string;

	@ExportRedacted()
	token: string;

	@ExportRedacted({ blank: true })
	hash: string;

	@ExportRedacted({ opaque: true })
	password: string;
}

const DESTINATION_ID = 'd0000000-0000-4000-8000-00000000000d';

/**
 * Re-importing an export archive into the tenant it came from UPDATES the rows it mapped before. The
 * archive holds placeholders where credentials were (GHSA-j5h5-r956-rxc3); written back, they would
 * replace live public-link tokens with masks and every password digest with `null`.
 */
describe('ImportEntityFieldMapOrCreateHandler', () => {
	const buildRepository = () => ({
		metadata: { target: Account, tableName: 'account' },
		findOneOrFail: jest.fn(async () => {
			throw new Error('not found');
		}),
		save: jest.fn(async (row: unknown) => row),
		create: jest.fn((row: unknown) => row)
	});

	const placeholders = {
		name: 'Renamed',
		token: '*'.repeat(36) + 'abcd',
		hash: null,
		password: OPAQUE_EXPORT_MASK
	};

	it('does not write redaction placeholders over a previously imported row', async () => {
		const repository = buildRepository();
		const commandBus = {
			execute: jest.fn(async () => ({ success: true, record: { destinationId: DESTINATION_ID } }))
		};
		const handler = new ImportEntityFieldMapOrCreateHandler(commandBus as any);

		await handler.execute(new ImportEntityFieldMapOrCreateCommand(repository as any, [], { ...placeholders }, 'src-1'));

		expect(repository.save).toHaveBeenCalledWith({ id: DESTINATION_ID, name: 'Renamed' });
	});

	it('still updates a marked column with a real value from a hand-built CSV', async () => {
		const repository = buildRepository();
		const commandBus = {
			execute: jest.fn(async () => ({ success: true, record: { destinationId: DESTINATION_ID } }))
		};
		const handler = new ImportEntityFieldMapOrCreateHandler(commandBus as any);

		await handler.execute(
			new ImportEntityFieldMapOrCreateCommand(
				repository as any,
				[],
				{ name: 'Renamed', token: 'real-token-value-0123456789', password: 'hunter2hunter2' },
				'src-1'
			)
		);

		expect(repository.save).toHaveBeenCalledWith({
			id: DESTINATION_ID,
			name: 'Renamed',
			token: 'real-token-value-0123456789',
			password: 'hunter2hunter2'
		});
	});

	describe('user rows', () => {
		const VERIFIED_AT = new Date('2026-01-15T10:00:00.000Z');

		const buildUserRepository = (liveEmail: string) => ({
			...buildRepository(),
			metadata: { target: class User {}, tableName: 'user' },
			findOne: jest.fn(async () => ({ id: DESTINATION_ID, email: liveEmail }))
		});
		const reimport = async (repository: any, row: Record<string, unknown>) => {
			const commandBus = {
				execute: jest.fn(async () => ({ success: true, record: { destinationId: DESTINATION_ID } }))
			};
			await new ImportEntityFieldMapOrCreateHandler(commandBus as any).execute(
				new ImportEntityFieldMapOrCreateCommand(repository, [], row, 'src-1')
			);
			return repository.save.mock.calls[0][0];
		};

		it('never takes the e-mail confirmation or a pending code from the archive', async () => {
			const repository = buildUserRepository('ada@example.com');

			const saved = await reimport(repository, {
				firstName: 'Ada',
				email: 'ada@example.com',
				emailVerifiedAt: VERIFIED_AT,
				code: 'KNOWN123',
				codeExpireAt: new Date('2099-01-01T00:00:00.000Z'),
				emailToken: 'planted'
			});

			expect(saved).toEqual({ id: DESTINATION_ID, firstName: 'Ada', email: 'ada@example.com' });
		});

		it('resets the confirmation when the archive moves the user to a different address', async () => {
			const repository = buildUserRepository('ada@example.com');

			const saved = await reimport(repository, { email: 'someone-else@example.com', emailVerifiedAt: VERIFIED_AT });

			expect(saved).toEqual({
				id: DESTINATION_ID,
				email: 'someone-else@example.com',
				emailVerifiedAt: null,
				emailToken: null,
				code: null,
				codeExpireAt: null
			});
		});

		it('keeps the live confirmation when the address only differs in case', async () => {
			const repository = buildUserRepository('ada@example.com');

			const saved = await reimport(repository, { email: 'Ada@Example.com' });

			expect(saved).toEqual({ id: DESTINATION_ID, email: 'Ada@Example.com' });
		});

		it('does not look the user up when the archive row carries no address', async () => {
			const repository = buildUserRepository('ada@example.com');

			const saved = await reimport(repository, { firstName: 'Ada', emailVerifiedAt: VERIFIED_AT });

			expect(saved).toEqual({ id: DESTINATION_ID, firstName: 'Ada' });
			expect(repository.findOne).not.toHaveBeenCalled();
		});
	});

	it('creates a new row unchanged — a NOT NULL credential column must still receive a value', async () => {
		const repository = buildRepository();
		const commandBus = {
			execute: jest.fn(async () => {
				throw new Error('no import record');
			})
		};
		const handler = new ImportEntityFieldMapOrCreateHandler(commandBus as any);

		await handler.execute(new ImportEntityFieldMapOrCreateCommand(repository as any, [], { ...placeholders }, 'src-1'));

		expect(repository.create).toHaveBeenCalledWith(placeholders);
	});
});
