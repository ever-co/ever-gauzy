/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { PublicInvoiceController } from './public-invoice.controller';
import { PublicInvoiceResolver } from './public-invoice.resolver';
import { FindPublicInvoiceQuery } from './queries';

/**
 * The shared invoice over GraphQL.
 *
 * The delivered route `GET /public/invoice/:id/:token` is public and reads one invoice by its share link.
 * This suite pins that the field is the same read — the same query, the same two members, the same public
 * marker and nothing narrower or wider stated on it — and that the operator's internal note never reaches
 * a link holder.
 */

const INVOICE = '00000000-0000-4000-8000-000000000010';
const TOKEN = 'header.payload.signature';

/** The row a scripted query bus answers with. */
const ROW = {
	id: INVOICE,
	invoiceNumber: '1001',
	currency: 'USD',
	totalValue: '120.50',
	status: 'SENT',
	token: TOKEN,
	internalNote: 'Client is late every month; chase on day one.'
};

/** The resolver, over a scripted query bus. */
function surfaces() {
	const queryBus = { execute: jest.fn().mockResolvedValue(ROW) };

	return { queryBus, resolver: new PublicInvoiceResolver(queryBus as never) };
}

/** The composed schema: every `.gql` under a `schema` directory of core, as the loader globs them. */
function composedSchema(): string {
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(join(__dirname, '..', '..'));

	return documents.join('\n');
}

const printed = printSchema(buildSchema(composedSchema()));

describe('PublicInvoiceResolver — the share link, over GraphQL', () => {
	it('declares the token read with the route’s two members, nullable as the invite precedent is', () => {
		expect(printed).toMatch(/invoiceByToken\(id: ID!, token: String!\): Invoice\n/);
	});

	it('dispatches the query the public route dispatches, with the link’s two members and no relation', async () => {
		const { resolver, queryBus } = surfaces();

		await resolver.invoiceByToken(INVOICE, TOKEN);

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(FindPublicInvoiceQuery);
		expect(query.params).toEqual({ id: INVOICE, token: TOKEN });
		expect(query.relations).toEqual([]);
	});

	it('withholds the operator’s internal note from the link holder', async () => {
		const { resolver } = surfaces();

		const invoice = await resolver.invoiceByToken(INVOICE, TOKEN);

		expect(invoice.internalNote).toBeUndefined();
		expect(invoice.totalValue).toBe('120.50');
		expect(invoice.id).toBe(INVOICE);
	});

	it('lets the refusal through rather than a null, so a live link cannot be told from a dead one', async () => {
		const { resolver, queryBus } = surfaces();
		const refusal = new ForbiddenException();
		queryBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.invoiceByToken(INVOICE, 'forged')).rejects.toBe(refusal);
	});

	it('is public as its route is, and states no guard and no permission beyond the gate', () => {
		const field = (PublicInvoiceResolver.prototype as unknown as Record<string, object>).invoiceByToken;

		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, field)).toBe(true);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, PublicInvoiceController)).toBe(true);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, field)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PublicInvoiceResolver)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', PublicInvoiceResolver)).toEqual([FeatureFlagGuard]);
		expect(Reflect.getMetadata('__guards__', PublicInvoiceResolver)).not.toContain(TenantPermissionGuard);
		expect(Reflect.getMetadata('__guards__', PublicInvoiceResolver)).not.toContain(PermissionGuard);
		expect(Reflect.getMetadata(FEATURE_METADATA, PublicInvoiceResolver)).toBe('FEATURE_GRAPHQL');
	});
});
