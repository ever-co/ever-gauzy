/**
 * Every column of the Inbox entities has a type both ORMs can map. A column without an explicit `type` takes it
 * from its design type, and this package compiles with `strictNullChecks`, where `Date | null` or `ID | null`
 * is emitted as `Object`. TypeORM refuses `Object` when the data source initialises ("Data type Object is not
 * supported"), so the API would not boot with `GAUZY_INBOX_ENABLED=true`. The database suite maps the tables
 * with fixture schemas, so only this suite sees the real decorators' metadata.
 */
const mockColumns: Array<{ target: object; property: string; options: { type?: unknown } | undefined }> = [];

jest.mock('@gauzy/core', () => {
	class BaseEntity {}
	return {
		MultiORMColumn: (options?: { type?: unknown }) => (target: object, property: string) => {
			mockColumns.push({ target, property, options });
		},
		MultiORMEntity: () => () => undefined,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {}
	};
});

import 'reflect-metadata';
import { InboxItem } from './inbox-item.entity';
import { InboxItemRecipient } from './inbox-item-recipient.entity';

/** The design types TypeORM and MikroORM map on Postgres, MySQL and SQLite. */
const MAPPABLE: unknown[] = [String, Number, Boolean, Date];

describe('Inbox entity metadata', () => {
	it('declares the columns of both entities', () => {
		const owners = new Set(mockColumns.map((column) => column.target));
		expect(owners).toEqual(new Set([InboxItem.prototype, InboxItemRecipient.prototype]));
		expect(mockColumns.length).toBeGreaterThan(20);
	});

	it.each(mockColumns.map((column) => [`${column.target.constructor.name}.${column.property}`, column]))(
		'%s has an explicit type or a mappable design type',
		(_name, column) => {
			if (column.options?.type !== undefined) return;
			const designType = Reflect.getMetadata('design:type', column.target, column.property);
			expect(MAPPABLE).toContain(designType);
		}
	);
});
