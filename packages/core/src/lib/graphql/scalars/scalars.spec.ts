import { readFileSync } from 'fs';
import { join } from 'path';
import { SCALAR_NAME_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { createScalarType } from '@nestjs/graphql/dist/utils/scalar-types.utils';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLScalarType, buildSchema, graphql } from 'graphql';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { CORE_SCALARS } from './index';

/**
 * The scalars as the endpoint runs them: turned into a resolver map by the driver's own
 * `createScalarType`, attached to the kernel's scalar declarations by the same `makeExecutableSchema`
 * the driver uses, and exercised through graphql-js rather than called directly.
 */
describe('the kernel scalars', () => {
	const sdl = readFileSync(join(__dirname, '..', 'schema', 'common.type.gql'), 'utf8');

	/** The kernel's scalar declarations, each with the description written above it. */
	const scalarDeclarations = [...sdl.matchAll(/(?:"""[\s\S]*?"""\s*)?^scalar\s+\w+/gm)].map((match) => match[0]);

	/** The resolver map the driver builds from a `@Scalar()` provider. */
	const scalarResolvers = (): Record<string, GraphQLScalarType> =>
		Object.fromEntries(
			CORE_SCALARS.map((type) => {
				const name = Reflect.getMetadata(SCALAR_NAME_METADATA, type) as string;

				return [name, createScalarType(name, new (type as new () => any)())];
			})
		);

	it('implement every scalar the kernel SDL declares', () => {
		// An SDL scalar with no implementation is not an error anywhere: graphql-js passes its values
		// through. This is the check that makes a fourth declaration without a class visible.
		const declared = [...sdl.matchAll(/^scalar\s+(\w+)/gm)].map((match) => match[1]).sort();
		const implemented = CORE_SCALARS.map((type) => Reflect.getMetadata(SCALAR_NAME_METADATA, type)).sort();

		expect(declared).toEqual(['DateTime', 'Decimal', 'JSON']);
		expect(implemented).toEqual(declared);
	});

	it('publish the description the SDL declares, so the endpoint serves the schema the snapshot shows', () => {
		// The driver's resolver map carries each class's description, and `makeExecutableSchema` copies a
		// scalar resolver's description over the SDL's — an absent one included. The snapshot is printed
		// from the SDL alone, so the two texts have to be the same text.
		const declared = buildSchema(`${scalarDeclarations.join('\n')}\ntype Query { unused: Int }`);
		const served = makeExecutableSchema({
			typeDefs: `${scalarDeclarations.join('\n')}\ntype Query { unused: Int }`,
			resolvers: scalarResolvers()
		});

		for (const name of ['DateTime', 'Decimal', 'JSON']) {
			const description = declared.getType(name)?.description;

			expect([name, description]).toEqual([name, expect.stringMatching(/\S/)]);
			expect([name, served.getType(name)?.description]).toEqual([name, description]);
		}
	});

	describe('on a schema', () => {
		const schema = makeExecutableSchema({
			typeDefs: `
				${scalarDeclarations.join('\n')}
				type Query {
					storedNoise: Decimal!
					storedNoiseText: Decimal!
					transformed: Decimal!
					text: Decimal
					at: DateTime!
					echo(amount: Decimal!): String!
					document(value: JSON): JSON
				}
			`,
			resolvers: {
				...scalarResolvers(),
				Query: {
					storedNoise: () => 0.1 + 0.2,
					storedNoiseText: () => String(0.1 + 0.2),
					transformed: () => 20.01,
					text: () => '1.2345678900',
					at: () => new Date(Date.UTC(2026, 8, 21, 10, 15, 30)),
					echo: (_: unknown, args: { amount: unknown }) => `${typeof args.amount}:${String(args.amount)}`,
					document: (_: unknown, args: { value: unknown }) => args.value
				}
			}
		});

		it('serves money as the documented string, and a stored imprecision without an error', async () => {
			// Before the scalars were implemented this answered `0.30000000000000004` and `20.01` as JSON
			// floats. A scalar that refused the noise instead would have answered `data: null` for the whole
			// response, because both fields are non-null and an error on one propagates to its parent.
			const result = await graphql({ schema, source: '{ storedNoise storedNoiseText transformed text at }' });

			expect(result.errors).toBeUndefined();
			expect(result.data).toEqual({
				storedNoise: '0.300000',
				storedNoiseText: '0.300000',
				transformed: '20.010000',
				text: '1.23456789',
				at: '2026-09-21T10:15:30.000Z'
			});
		});

		it('refuses a boolean literal where a decimal is declared, with the validation code', async () => {
			const result = await graphql({ schema, source: '{ echo(amount: true) }' });

			expect(result.data).toBeUndefined();
			expect(result.errors?.[0]?.extensions?.code).toBe(ApiErrorCode.VALIDATION_FAILED);
		});

		it('refuses a variable that is not a decimal', async () => {
			const result = await graphql({
				schema,
				source: 'query ($amount: Decimal!) { echo(amount: $amount) }',
				variableValues: { amount: [] }
			});

			expect(result.data).toBeUndefined();
			expect(result.errors).toHaveLength(1);
		});

		it('hands the resolver a decimal in the type the caller sent it in', async () => {
			const asString = await graphql({
				schema,
				source: 'query ($amount: Decimal!) { echo(amount: $amount) }',
				variableValues: { amount: '19.99' }
			});
			const asNumber = await graphql({ schema, source: '{ echo(amount: 19.99) }' });

			expect(asString.data).toEqual({ echo: 'string:19.99' });
			expect(asNumber.data).toEqual({ echo: 'number:19.99' });
		});

		it('carries a JSON document through', async () => {
			const result = await graphql({ schema, source: '{ document(value: { a: [1, "b"] }) }' });

			expect(result.errors).toBeUndefined();
			expect(result.data?.['document']).toEqual({ a: [1, 'b'] });
		});
	});
});
