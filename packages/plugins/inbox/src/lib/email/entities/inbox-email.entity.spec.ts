/**
 * #11096 review: the entity declares the column types the migrations build, so a schema made with
 * `DB_SYNCHRONIZE=true` matches a migrated one — `longtext` on MySQL (whose `text` stops at 64 KB), `text` elsewhere.
 */
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';

const LONG_COLUMNS = [
	'referenceIds',
	'sender',
	'toAddresses',
	'ccAddresses',
	'bccAddresses',
	'replyToAddresses',
	'textBody',
	'htmlSanitized',
	'headers'
];

function columnTypes(dbType: string | undefined): Record<string, unknown> {
	const original = process.env.DB_TYPE;
	let target: unknown;
	try {
		if (dbType === undefined) delete process.env.DB_TYPE;
		else process.env.DB_TYPE = dbType;
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			target = require('./inbox-email.entity').InboxEmail;
		});
	} finally {
		if (original === undefined) delete process.env.DB_TYPE;
		else process.env.DB_TYPE = original;
	}
	return Object.fromEntries(
		getMetadataArgsStorage()
			.columns.filter((column) => column.target === target && LONG_COLUMNS.includes(column.propertyName))
			.map((column) => [column.propertyName, column.options.type])
	);
}

describe('InboxEmail column types', () => {
	it('declares the long text columns as longtext on MySQL', () => {
		expect(columnTypes('mysql')).toEqual(Object.fromEntries(LONG_COLUMNS.map((name) => [name, 'longtext'])));
	});

	it('declares them as text on the other databases', () => {
		for (const dbType of ['postgres', 'better-sqlite3', undefined]) {
			expect(columnTypes(dbType)).toEqual(Object.fromEntries(LONG_COLUMNS.map((name) => [name, 'text'])));
		}
	});
});
