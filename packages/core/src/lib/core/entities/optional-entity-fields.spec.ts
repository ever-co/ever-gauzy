import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * An optional entity field that carries a validator also carries `@IsOptional()`.
 *
 * class-validator runs every decorator of a property unless `@IsOptional()` (or `@ValidateIf`) says an absent
 * value is acceptable, so `@IsBoolean()` alone refuses a request that simply omits the field. The entity
 * classes are what the request types extend (`PartialType`, `PickType`, `IntersectionType` copy the
 * decorators), so a field the commerce extension added as optional — a column with a default, such as
 * `currency.isTender` or `warehouse.priority` — would make any request type built from the entity reject a
 * body that leaves it out, and the default would never be reached. Thirty-six such fields across ten
 * entities were missing the decorator.
 *
 * The suite reads the decorators out of the sources (loading the entities would load the entity graph). The
 * fields `develop` already declared that way are recorded rather than changed, because changing what an
 * existing route accepts is not this fix's to decide; an entry fails the suite once it is fixed.
 */

/** The entities the extension added optional, validated fields to. */
const ENTITY_FILES = [
	'currency/currency.entity.ts',
	'organization-contact/organization-contact.entity.ts',
	'payment/payment.entity.ts',
	'product/product.entity.ts',
	'product-category/product-category.entity.ts',
	'product-variant/product-variant.entity.ts',
	'tenant/tenant-setting/tenant-setting.entity.ts',
	'warehouse/warehouse.entity.ts',
	'warehouse/warehouse-product.entity.ts',
	'warehouse/warehouse-product-variant.entity.ts'
];

/** Fields `develop` already declares optional and validated without `@IsOptional()`, by `<file>#<property>`. */
const PRE_EXISTING: ReadonlyArray<string> = Object.freeze([
	'payment/payment.entity.ts#amount',
	'product/product.entity.ts#featuredImageId',
	'product/product.entity.ts#productCategoryId',
	'product/product.entity.ts#productTypeId',
	'product-variant/product-variant.entity.ts#imageId',
	'product-variant/product-variant.entity.ts#productId'
]);

/** A class-validator decorator that validates a value (as opposed to `@IsOptional` / `@ValidateIf`). */
const VALIDATOR = /^(Is[A-Z]\w*|Max\w*|Min\w*|Length|Matches|ValidateNested|ArrayM\w+)$/;

/** `packages/core/src/lib`, two levels above this directory. */
const LIB = path.resolve(__dirname, '../..');

/**
 * The optional properties of a file that state a validator and no way for the value to be absent.
 *
 * @param file The entity file, relative to `lib`.
 * @returns `<file>#<property>` for each one.
 */
function unguarded(file: string): string[] {
	const source = ts.createSourceFile(file, fs.readFileSync(path.join(LIB, file), 'utf8'), ts.ScriptTarget.Latest, true);
	const found: string[] = [];

	const visit = (node: ts.Node): void => {
		if (ts.isPropertyDeclaration(node) && node.questionToken) {
			const names = (ts.getDecorators(node) ?? []).map((decorator) => {
				const expression = decorator.expression;

				return ts.isCallExpression(expression) ? expression.expression.getText(source) : expression.getText(source);
			});

			if (
				names.some((name) => VALIDATOR.test(name) && name !== 'IsOptional') &&
				!names.includes('IsOptional') &&
				!names.includes('ValidateIf')
			) {
				found.push(`${file}#${node.name.getText(source)}`);
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(source);

	return found;
}

describe('optional, validated entity fields', () => {
	const found = ENTITY_FILES.flatMap((file) => unguarded(file));

	it('state @IsOptional() on every field the commerce extension added', () => {
		expect(found.filter((entry) => !PRE_EXISTING.includes(entry))).toEqual([]);
	});

	it('keeps the record of the pre-existing fields honest', () => {
		expect(PRE_EXISTING.filter((entry) => !found.includes(entry))).toEqual([]);
	});

	it('CONTROL: reads the decorators, so a field it knows to carry @IsOptional() is seen to', () => {
		const source = fs.readFileSync(path.join(LIB, 'currency/currency.entity.ts'), 'utf8');

		expect(source).toMatch(/@IsOptional\(\)\s+@IsBoolean\(\)\s+@MultiORMColumn\(\{ type: 'boolean', default: true \}\)\s+isTender\?: boolean;/);
	});
});
