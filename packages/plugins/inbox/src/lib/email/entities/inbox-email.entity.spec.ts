/**
 * #11096 review: the entity declares the column types the migrations build, so a schema made with
 * `DB_SYNCHRONIZE=true` matches a migrated one — `longtext` on MySQL (whose `text` stops at 64 KB), `text` elsewhere.
 */
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { InboxEmail, inboxEmailLongTextType } from './inbox-email.entity';

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

describe('InboxEmail long text columns', () => {
	it('are longtext on MySQL and text on the other databases', () => {
		expect(inboxEmailLongTextType(true)).toBe('longtext');
		expect(inboxEmailLongTextType(false)).toBe('text');
	});

	it('all take that type for the database in use (text here, where DB_TYPE is not mysql)', () => {
		const types = Object.fromEntries(
			getMetadataArgsStorage()
				.columns.filter((column) => column.target === InboxEmail && LONG_COLUMNS.includes(column.propertyName))
				.map((column) => [column.propertyName, column.options.type])
		);
		expect(types).toEqual(Object.fromEntries(LONG_COLUMNS.map((name) => [name, inboxEmailLongTextType()])));
		expect(inboxEmailLongTextType()).toBe('text');
	});
});
