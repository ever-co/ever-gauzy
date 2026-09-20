import { ValueTransformer } from 'typeorm';
import { ColumnNumericTransformerPipe } from '../../../shared/pipes';
import { parseMikroOrmColumnOptions } from './column.helper';
import { ValueTransformerType } from './value-transformer.type';

/**
 * MikroORM has no `transformer` column option. Before the bridge, `@MultiORMColumn({ transformer })`
 * handed it to `@Property`, which ignored it: under `DB_ORM=mikro-orm` money columns skipped rounding
 * and validation, and int-backed enum columns were stored raw.
 */
describe('parseMikroOrmColumnOptions: TypeORM transformer bridge', () => {
	const moneyOptions = () =>
		parseMikroOrmColumnOptions({
			type: 'numeric',
			options: { nullable: true, precision: 14, scale: 2, transformer: new ColumnNumericTransformerPipe(2) }
		}) as any;

	it('wraps the transformer in a MikroORM type and drops the option MikroORM ignores', () => {
		const options = moneyOptions();

		expect(options.type).toBeInstanceOf(ValueTransformerType);
		expect(options.transformer).toBeUndefined();
		expect(options.nullable).toBe(true);
	});

	it('keeps the declared column DDL, with precision and scale', () => {
		const options = moneyOptions();

		expect(options.columnType).toBe('numeric(14,2)');
		expect(options.type.getColumnType()).toBe('numeric(14,2)');
	});

	it('rounds on write and returns a number on read, as TypeORM does', () => {
		const { type } = moneyOptions();

		expect(type.convertToDatabaseValue(10.499)).toBe(10.5);
		expect(type.convertToDatabaseValue(1.005)).toBe(1.01);
		expect(type.convertToJSValue('10.49')).toBe(10.49);
		expect(type.convertToJSValue(null)).toBeNull();
	});

	it('works for a non-numeric transformer too (int-backed enums)', () => {
		const transformer: ValueTransformer = {
			to: (value: string) => (value === 'ON' ? 1 : 0),
			from: (value: number) => (value === 1 ? 'ON' : 'OFF')
		};

		const { type, columnType } = parseMikroOrmColumnOptions({ type: 'int', options: { transformer } }) as any;

		expect(columnType).toBe('int');
		expect(type.convertToDatabaseValue('ON')).toBe(1);
		expect(type.convertToJSValue(0)).toBe('OFF');
	});

	it('leaves columns without a transformer untouched', () => {
		const options = parseMikroOrmColumnOptions({
			type: 'varchar',
			options: { nullable: true, length: 255 }
		}) as any;

		expect(options).toEqual({ type: 'varchar', nullable: true, length: 255 });
	});
});
