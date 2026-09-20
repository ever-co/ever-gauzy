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

	it('applies an array of transformers in TypeORM order (to forwards, from reversed)', () => {
		const double: ValueTransformer = { to: (value: number) => value * 2, from: (value: number) => value / 2 };
		const add: ValueTransformer = { to: (value: number) => value + 1, from: (value: number) => value - 1 };

		const { type } = parseMikroOrmColumnOptions({ type: 'int', options: { transformer: [double, add] } }) as any;

		expect(type.convertToDatabaseValue(5)).toBe(11); // (5 * 2) + 1
		expect(type.convertToJSValue(11)).toBe(5); // (11 - 1) / 2
	});

	it('keeps the DDL modifiers a column declares', () => {
		const varcharColumn = parseMikroOrmColumnOptions({
			type: 'varchar',
			options: { length: 255, transformer: { to: (v: string) => v, from: (v: string) => v } }
		}) as any;
		const explicitColumn = parseMikroOrmColumnOptions({
			type: 'numeric',
			options: { columnType: 'decimal(10,4)', transformer: new ColumnNumericTransformerPipe(2) }
		}) as any;

		expect(varcharColumn.columnType).toBe('varchar(255)');
		expect(varcharColumn.type.getColumnType()).toBe('varchar(255)');
		// An explicit columnType wins, and the wrapper must report the same DDL to MikroORM.
		expect(explicitColumn.columnType).toBe('decimal(10,4)');
		expect(explicitColumn.type.getColumnType()).toBe('decimal(10,4)');
	});

	it('leaves columns without a transformer untouched', () => {
		const options = parseMikroOrmColumnOptions({
			type: 'varchar',
			options: { nullable: true, length: 255 }
		}) as any;

		expect(options).toEqual({ type: 'varchar', nullable: true, length: 255 });
	});
});
