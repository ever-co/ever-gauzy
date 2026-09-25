/**
 * `PasswordReset.expired` is computed when either ORM loads the row.
 *
 * It is a virtual column set by the entity's load hook. The hook was declared for TypeORM only (`@AfterLoad`), so
 * under `DB_ORM=mikro-orm` `expired` was never set and the password reset's "Token has expired" check never refused
 * a stale token. The entity is imported under `DB_ORM=mikro-orm` in its own registry, as the decorators decide
 * their ORM when the class is defined, and MikroORM's decorator metadata is read for the hook.
 */
describe('PasswordReset under MikroORM', () => {
	it('registers its load hook with MikroORM, and the hook marks a stale reset expired', () => {
		const previous = process.env.DB_ORM;
		process.env.DB_ORM = 'mikro-orm';

		try {
			jest.isolateModules(() => {
				require('../core/entities/internal');
				const { MetadataStorage } = require('@mikro-orm/core');
				const { PasswordReset } = require('./password-reset.entity');

				const meta = MetadataStorage.getMetadataFromDecorator(PasswordReset);
				expect(meta.hooks.onLoad).toContain('afterLoadEntity');

				const stale = Object.assign(new PasswordReset(), { createdAt: new Date(Date.now() - 11 * 60 * 1000) });
				stale.afterLoadEntity();
				expect(stale.expired).toBe(true);

				const fresh = Object.assign(new PasswordReset(), { createdAt: new Date() });
				fresh.afterLoadEntity();
				expect(fresh.expired).toBe(false);
			});
		} finally {
			if (previous === undefined) delete process.env.DB_ORM;
			else process.env.DB_ORM = previous;
		}
	});
});
