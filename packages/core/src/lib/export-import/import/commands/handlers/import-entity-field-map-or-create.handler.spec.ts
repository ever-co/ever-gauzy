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
