/**
 * Money on the marketplace's GraphQL surface is an exact decimal, never a float (owner decision 7,
 * 2026-10-13: "Convert to Decimal").
 *
 * `tools/scripts/money-type-check.mjs` reads the composed schema and the code-first classes; this reads the
 * package's own SDL contribution, so a regression is caught by the suite that owns the field rather than only
 * once the whole schema is composed — the convention the inventory package's suite set for its amounts.
 *
 * **A commission band's boundaries are money on an amount basis.** `ICommissionTier.from`/`to` are typed
 * `DecimalString | number` because "a band boundary is money", and `SellerCommissionService` decides which band
 * a sale falls into with `compareDecimalStrings` — yet `CommissionTierInput` declared them `Float`, so a GraphQL
 * client could not send the exact boundary the REST route accepts (`"100.10"` is refused by `Float`), and a
 * generated client parsed the bound as a double. The names (`from`, `to`) carry no money word, which is why the
 * gate's vocabulary never saw them.
 */
import { Kind, parse, print, TypeNode } from 'graphql';
import { schemaExtensions } from './schema-extensions';

const document = typeof schemaExtensions === 'string' ? parse(schemaExtensions) : schemaExtensions;

/**
 * The named type of one member of an input or object type in the package's SDL.
 *
 * @param typeName The type.
 * @param member The member.
 * @returns The member's type as the SDL spells it (`Decimal!`), or `undefined` when either is not declared.
 */
function memberType(typeName: string, member: string): string | undefined {
	for (const definition of document.definitions) {
		if (
			(definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION || definition.kind === Kind.OBJECT_TYPE_DEFINITION) &&
			definition.name.value === typeName
		) {
			const field = (definition.fields ?? []).find((candidate) => candidate.name.value === member);
			return field ? print(field.type as TypeNode) : undefined;
		}
	}

	return undefined;
}

describe('marketplace money is an exact decimal on the GraphQL surface', () => {
	it.each([
		['from', 'Decimal!'],
		['to', 'Decimal'],
		['rate', 'Decimal!']
	])('CommissionTierInput.%s is %s, never a Float', (member, expected) => {
		expect(memberType('CommissionTierInput', member)).toBe(expected);
	});

	it.each([
		['SellerBalance', ['available', 'pending', 'held', 'negativeCarryForward', 'reserveNextRun']],
		['SellerTransaction', ['grossAmount', 'sellerDiscountAmount', 'platformDiscountAmount', 'commissionRate']],
		['SellerSplitReconciliation', ['platformDiscount', 'splitDelta', 'platformRetained']]
	])('%s serves its amounts as Decimal (the code-first classes restate these)', (typeName, members) => {
		for (const member of members as string[]) {
			expect(`${typeName}.${member}: ${memberType(typeName, member)}`).toBe(`${typeName}.${member}: Decimal!`);
		}
	});
});
