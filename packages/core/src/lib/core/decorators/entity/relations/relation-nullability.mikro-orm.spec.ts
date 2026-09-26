import { MetadataStorage } from '@mikro-orm/core';
import { MultiORMManyToOne } from './many-to-one.decorator';
import { MultiORMOneToOne } from './one-to-one.decorator';

/**
 * A many-to-one (and an owning one-to-one) declared without `nullable` is optional on MikroORM, as on TypeORM.
 *
 * TypeORM's relations are nullable unless stated otherwise, and the migrations — written from TypeORM's mapping —
 * leave their join columns nullable. MikroORM's default is the opposite, so the same declaration was required
 * there: a standalone product variant, which TypeORM saves, was refused under `DB_ORM=mikro-orm` with
 * "Value for ProductVariant.product is required". A stated `nullable` is kept on both.
 */
describe('relation nullability under MikroORM', () => {
	const previous = process.env.DB_ORM;

	beforeAll(() => {
		process.env.DB_ORM = 'mikro-orm';
	});

	afterAll(() => {
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
	});

	class Target {
		id!: string;
	}

	/** The MikroORM property the decorators registered for `target.property`. */
	const mikroOrmProperty = (target: Function, property: string): any =>
		MetadataStorage.getMetadataFromDecorator(target as any).properties[property as never];

	it('makes a many-to-one declared without `nullable` optional, and keeps a stated one', () => {
		class Holder {
			unstated?: Target;
			required?: Target;
			optional?: Target;
		}
		MultiORMManyToOne(() => Target)(Holder.prototype, 'unstated');
		MultiORMManyToOne(() => Target, { nullable: false })(Holder.prototype, 'required');
		MultiORMManyToOne(() => Target, { nullable: true })(Holder.prototype, 'optional');

		expect(mikroOrmProperty(Holder, 'unstated').nullable).toBe(true);
		expect(mikroOrmProperty(Holder, 'required').nullable).toBe(false);
		expect(mikroOrmProperty(Holder, 'optional').nullable).toBe(true);
	});

	it('makes the owning side of a one-to-one declared without `nullable` optional, and leaves the inverse side alone', () => {
		class Owner {
			target?: Target;
		}
		class Inverse {
			owner?: Owner;
		}
		MultiORMOneToOne(() => Target, { owner: true })(Owner.prototype, 'target');
		MultiORMOneToOne(
			() => Owner,
			(owner: Owner) => owner.target
		)(Inverse.prototype, 'owner');

		expect(mikroOrmProperty(Owner, 'target').nullable).toBe(true);
		expect(mikroOrmProperty(Inverse, 'owner').nullable).toBeUndefined();
	});
});
