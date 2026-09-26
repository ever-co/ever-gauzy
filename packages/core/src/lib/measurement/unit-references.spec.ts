import {
	IUnitReference,
	KERNEL_UNIT_REFERENCES,
	registeredUnitReferences,
	registerUnitReferences,
	withdrawUnitReferences
} from './unit-references';
import { UnitCategoryCode } from './measurement.constants';

/**
 * The declared unit references, and the rule that a column has exactly one description.
 *
 * The registry's own properties are what the nightly audit rests on, so they are asserted directly
 * rather than through the audit: an audit built on a registry that silently dropped a declaration, or
 * silently let a second package redefine a column, would report a clean installation that was not
 * being looked at.
 */
describe('the unit reference registry', () => {
	const OWNER = 'unit-reference-spec';

	afterEach(() => {
		withdrawUnitReferences(OWNER);
	});

	it('starts with the kernel references', () => {
		const declared = registeredUnitReferences();

		for (const reference of KERNEL_UNIT_REFERENCES) {
			expect(declared).toContainEqual(reference);
		}
	});

	it('states that a variant is stocked in the reference unit of its family', () => {
		const stock = registeredUnitReferences().find(
			(reference) => reference.table === 'product_variant' && reference.column === 'stockUnitId'
		);

		expect(stock?.referenceUnit).toBe(true);
		expect(stock?.owner).toBe('core');
	});

	it('binds the sales and purchase units to the family the variant is stocked in', () => {
		const declared = registeredUnitReferences();
		const sales = declared.find((reference) => reference.column === 'salesUnitId');
		const purchase = declared.find((reference) => reference.column === 'purchaseUnitId');

		expect(sales?.sameCategoryAs).toBe('stockUnitId');
		expect(purchase?.sameCategoryAs).toBe('stockUnitId');
	});

	it('fixes the shipping weight to mass and nothing else', () => {
		const weight = registeredUnitReferences().find((reference) => reference.column === 'weightUnitId');

		expect(weight?.category).toBe(UnitCategoryCode.MASS);
	});

	it('declares a reference a package owns', () => {
		registerUnitReferences([
			{ table: 'spec_table', column: 'unitId', owner: OWNER, description: 'A spec reference.' }
		]);

		expect(registeredUnitReferences().some((reference) => reference.table === 'spec_table')).toBe(true);
	});

	it('treats registering the same declaration twice as a no-op', () => {
		const reference: IUnitReference = {
			table: 'spec_table',
			column: 'unitId',
			owner: OWNER,
			description: 'A spec reference.'
		};

		registerUnitReferences([reference]);
		registerUnitReferences([reference]);

		expect(
			registeredUnitReferences().filter((declared) => declared.table === 'spec_table')
		).toHaveLength(1);
	});

	it('lets a capability revise its own declaration', () => {
		registerUnitReferences([
			{ table: 'spec_table', column: 'unitId', owner: OWNER, description: 'First.' }
		]);
		registerUnitReferences([
			{ table: 'spec_table', column: 'unitId', owner: OWNER, category: UnitCategoryCode.MASS, description: 'Second.' }
		]);

		const declared = registeredUnitReferences().filter((reference) => reference.table === 'spec_table');

		expect(declared).toHaveLength(1);
		expect(declared[0].description).toBe('Second.');
		expect(declared[0].category).toBe(UnitCategoryCode.MASS);
	});

	it('refuses a second owner on a kernel column', () => {
		expect(() =>
			registerUnitReferences([
				{ table: 'product_variant', column: 'stockUnitId', owner: OWNER, description: 'A second opinion.' }
			])
		).toThrow(/already declared by core/);
	});

	it('refuses a declaration that names no column', () => {
		expect(() =>
			registerUnitReferences([{ table: 'spec_table', column: '', owner: OWNER, description: '' }])
		).toThrow(/must name the table and the column/);
	});

	it('withdraws only the declaring capability references', () => {
		const before = registeredUnitReferences().length;

		registerUnitReferences([
			{ table: 'spec_table', column: 'unitId', owner: OWNER, description: 'A spec reference.' }
		]);

		expect(withdrawUnitReferences(OWNER)).toBe(1);
		expect(registeredUnitReferences()).toHaveLength(before);
		expect(registeredUnitReferences()).toContainEqual(
			KERNEL_UNIT_REFERENCES.find((reference) => reference.column === 'stockUnitId')
		);
	});

	it('returns the references in a stable order', () => {
		const first = registeredUnitReferences().map((reference) => `${reference.table}.${reference.column}`);
		const second = registeredUnitReferences().map((reference) => `${reference.table}.${reference.column}`);

		expect(second).toEqual(first);
		expect([...first].sort()).toEqual(first);
	});
});
