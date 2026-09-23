/**
 * The module boundaries are doubled for the reason the package's service specs state: `@gauzy/core`
 * boots the whole application graph from its barrel and `@gauzy/config` reads the environment at
 * import time, neither of which a resolver needs.
 *
 * Three things are deliberately **real**, because they are what this suite is about:
 *
 * - `FieldVisibility` is loaded from its own module rather than doubled, so the gate under test is the
 *   platform's decision and the platform's denial — only `canSee` is replaced, exactly as the core
 *   projection suite replaces it, and the `guard`/`denialFor` pair that produces the typed error is
 *   the real one (its own `RequestContext` read is mocked, because jest has no cluster to open);
 * - `VisibleWith` is the platform's own decorator, so the declaration the schema and the projections
 *   read is written by the code that writes it in production;
 * - the resolvers and the lifecycle services are the package's own, over a stubbed kernel.
 */
jest.mock('@gauzy/core/src/lib/core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => null,
		currentUserId: () => null,
		currentTenantId: () => null,
		currentOrganizationId: () => null,
		currentEmployeeId: () => null,
		currentTraceId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}
	}

	return {
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		RolePermissionModule: class RolePermissionModule {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// The platform's feature gate, which every resolver class carries: the chain asserted below is
		// the production chain, so the class the guard is stated as has to be the one the resolver imports.
		FeatureFlagGuard: class FeatureFlagGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		UseValidationPipe: decorator,
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		// The retry declaration the mutations carry is written by the kernel's own decorator, so the
		// assertions below read what the kernel's interceptor reads.
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		VisibleWith: jest.requireActual('@gauzy/core/src/lib/api/visible-with.decorator').VisibleWith,
		FieldVisibility: jest.requireActual('@gauzy/core/src/lib/api/field-visibility.service').FieldVisibility,
		// The page-to-connection mapping is the kernel's, and this package's resolver reaches it through its
		// own `toConnection` — so the double has to carry it, or the suite fails on a missing function rather
		// than on an assertion. Same reasoning as the visible-with double above: the real one is used.
		connectionFromPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').connectionFromPage,
		// The list fields resolve their window through the kernel too, now that they read the `page` their
		// SDL declares — and map the page with the offset they read at, which is `connectionFromOffsetPage`.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		PaymentAccountHolder: class PaymentAccountHolder {},
		PaymentMethodToken: class PaymentMethodToken {},
		PaymentAccountHolderService: class PaymentAccountHolderService {},
		PaymentMethodTokenService: class PaymentMethodTokenService {},
		PaymentInstrumentModule: class PaymentInstrumentModule {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	}),
	{ virtual: true }
);

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { print } from 'graphql';
import { PERMISSIONS_METADATA, VISIBLE_WITH_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, FieldVisibility, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core/src/lib/idempotency/idempotency.policy';
import { PaymentPermission } from '../../payment.permissions';
import { PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED } from '../../payment.card-data.pipe';
import { PaymentAccountHolderLifecycleService } from '../../payment-account-holder/payment-account-holder-lifecycle.service';
import { PaymentMethodTokenLifecycleService } from '../../payment-method-token/payment-method-token-lifecycle.service';
import { schemaExtensions } from '../schema-extensions';
import { PaymentAccountHolderResolver } from './payment-account-holder.resolver';
import { PaymentMethodTokenResolver } from './payment-method-token.resolver';

/**
 * The remembered payer over GraphQL (17-graphql-api-specification.md §3.2, §6.4, §9.7).
 *
 * The suite pins the half of the contract that is easy to get quietly wrong:
 *
 * - the schema declares the four root fields and the seven mutations of the coverage table, under the
 *   names it lists, and every one of them has a resolver behind it;
 * - the same permission guards each pair of surfaces: `PAYMENT_ACCOUNT_HOLDERS_VIEW` /
 *   `_EDIT` and `PAYMENT_METHOD_TOKENS_VIEW` / `_EDIT`, on metadata a guard reads;
 * - `PaymentMethodToken.token` is **declared** — a schema that varied by caller would be two schemas —
 *   and gated: readable with `PAYMENT_METHOD_TOKENS_CHARGE`, and `null` plus a typed denial without
 *   it, naming the field and the permission the contract publishes;
 * - no list carries the stored reference, whatever the caller holds;
 * - no input type declares a card member, and a card member smuggled into a declared free-form member
 *   is refused with the same code REST answers with.
 */

const HOLDER = '00000000-0000-4000-8000-0000000000a1';
const TOKEN = '00000000-0000-4000-8000-0000000000b1';
const REFERENCE = 'the-providers-own-reference';

/** The composed schema document, as text, so a field can be asserted the way a client reads it. */
const schemaText = print(schemaExtensions);

/**
 * A pattern matching a declaration as the schema spells it, whatever the document's line breaks are.
 *
 * The document is formatted for reading, so a mutation with a long input is wrapped — an assertion
 * written against one line would report the field as missing while it is declared two lines above.
 *
 * @param declaration The declaration to match, spaced as it would read on one line.
 * @returns The whitespace-tolerant pattern.
 */
const declared = (declaration: string): RegExp =>
	new RegExp(
		declaration
			.split(/\s+/)
			.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('\\s*')
	);

/**
 * A real `FieldVisibility` whose answer to "may this caller see this?" is fixed by the test.
 *
 * Only the decision is replaced: `guard` and `denialFor` — the pair that produces the typed error the
 * contract publishes — are the platform's own.
 */
const visibilityFor = (granted: string[]): FieldVisibility => {
	const visibility = new FieldVisibility();
	visibility.canSee = (permission) => granted.includes(permission as never);

	return visibility;
};

/** The instrument a stubbed kernel answers with; the reference is the value under test. */
const instrument = {
	id: TOKEN,
	accountHolderId: HOLDER,
	providerKey: 'a-provider',
	token: REFERENCE,
	type: 'CARD',
	brand: 'a-brand',
	last4: '4242',
	isDefault: true,
	status: 'ACTIVE'
} as never;

/**
 * Builds both resolvers over one stubbed kernel and one field-visibility decision.
 */
function surfaces(granted: string[] = []) {
	const kernel = {
		findTokenOrFail: jest.fn(async () => instrument),
		findAll: jest.fn(async () => ({ items: [instrument], total: 1 })),
		recordProviderInstrument: jest.fn(async () => instrument),
		updateToken: jest.fn(async () => instrument),
		setDefaultToken: jest.fn(async () => instrument),
		revokeToken: jest.fn(async () => ({ ...(instrument as object), status: 'REVOKED' })),
		listByHolder: jest.fn(async () => [instrument]),
		findDefaultToken: jest.fn(async () => null)
	};
	const holderKernel = {
		findHolderOrFail: jest.fn(async () => ({ id: HOLDER, status: 'PENDING' })),
		findAll: jest.fn(async () => ({ items: [{ id: HOLDER }], total: 1 })),
		createHolder: jest.fn(async () => ({ id: HOLDER })),
		updateHolder: jest.fn(async () => ({ id: HOLDER })),
		recordProviderAccount: jest.fn(async () => ({ id: HOLDER })),
		transitionStatus: jest.fn(async () => ({ id: HOLDER })),
		disableHolder: jest.fn(async () => ({ id: HOLDER, status: 'DISABLED' }))
	};
	const holders = { listHolders: jest.fn(async () => [{ id: HOLDER }]) };
	const visibility = visibilityFor(granted);
	const tokens = new PaymentMethodTokenLifecycleService(kernel as never, holders as never, visibility);
	const accounts = new PaymentAccountHolderLifecycleService(holderKernel as never, tokens);

	return {
		kernel,
		holderKernel,
		tokens,
		accounts,
		accountResolver: new PaymentAccountHolderResolver(holderKernel as never, accounts, tokens),
		tokenResolver: new PaymentMethodTokenResolver(tokens, visibility)
	};
}

describe('the stored-instrument resources in the schema (17 §3.2)', () => {
	it('declares the four root fields of the payment row', () => {
		expect(schemaText).toMatch(/paymentAccountHolders\(/);
		expect(schemaText).toMatch(/paymentAccountHolder\(id: ID!\): PaymentAccountHolder/);
		expect(schemaText).toMatch(/paymentMethodTokens\(/);
		expect(schemaText).toMatch(/paymentMethodToken\(id: ID!\): PaymentMethodToken/);
		expect(schemaText).toMatch(/type PaymentAccountHolder \{/);
		expect(schemaText).toMatch(/type PaymentMethodToken \{/);
		expect(schemaText).toMatch(/type PaymentAccountHolderConnection \{/);
		expect(schemaText).toMatch(/type PaymentMethodTokenConnection \{/);
	});

	it('declares the seven mutations of the payment row, by name', () => {
		for (const mutation of [
			'createPaymentAccountHolder(input: CreatePaymentAccountHolderInput!)',
			'updatePaymentAccountHolder(input: UpdatePaymentAccountHolderInput!)',
			'verifyPaymentAccountHolder(input: VerifyPaymentAccountHolderInput!)',
			'deletePaymentAccountHolder(id: ID!)',
			'createPaymentMethodToken(input: CreatePaymentMethodTokenInput!)',
			'setDefaultPaymentMethodToken(id: ID!)',
			'revokePaymentMethodToken(id: ID!)'
		]) {
			expect(schemaText).toMatch(declared(mutation));
		}
	});

	it('declares the token as a nullable field rather than omitting it', () => {
		// A field that is never legitimately readable is a schema omission, but this one *is* readable —
		// by a caller that may charge the instrument — so it is declared and gated at resolution time.
		// The printed document is re-indented by the printer, so the body is matched by whitespace.
		expect(schemaText).toMatch(/type PaymentMethodToken \{[\s\S]*?\n\s+token: String\n/);
		expect(schemaText).toMatch(/input PaymentMethodTokenConfirmationInput \{/);
	});

	it('declares no card member in any input type', () => {
		// The schema is the whitelist: a member it does not declare never reaches a resolver. The names
		// are the ones 06 §6.8 and 05 §3.19–§3.20 forbid, and none of them is a prefix of a declared
		// member (`expiryMonth` is not `expiry:`), so a match here is a card member.
		expect(schemaText).not.toMatch(
			/\b(number|cardNumber|pan|cvc|cvv|cvv2|iban|accountNumber|expiry|expiryDate|expirationDate)\s*:/i
		);
	});
});

describe('the stored-instrument resolvers (17 §3.2, §6.8)', () => {
	it('guards both resolvers with the tenant and permission guards', () => {
		for (const surface of [PaymentAccountHolderResolver, PaymentMethodTokenResolver]) {
			const guards = Reflect.getMetadata('__guards__', surface) ?? [];

			// The platform's feature gate is the last member of the chain, after the two permission
			// guards: a caller with no credential is refused as a credential problem before a tenant's
			// switches are consulted. The chain is asserted whole rather than by membership, because a
			// guard that was dropped to add another would still answer `toContain`.
			expect(guards).toEqual([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]);
		}
	});

	it('carries the read permission on the queries and the edit permission on the mutations', () => {
		const reads: Array<[never, string[]]> = [
			[PaymentAccountHolderResolver.prototype.paymentAccountHolders as never, [PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW]],
			[PaymentAccountHolderResolver.prototype.paymentAccountHolder as never, [PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW]],
			[PaymentMethodTokenResolver.prototype.paymentMethodTokens as never, [PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW]],
			[PaymentMethodTokenResolver.prototype.paymentMethodToken as never, [PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW]]
		];

		for (const [handler, expected] of reads) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual(expected);
		}

		const writes: Array<[never, string[]]> = [
			[PaymentAccountHolderResolver.prototype.createPaymentAccountHolder as never, [PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT]],
			[PaymentAccountHolderResolver.prototype.updatePaymentAccountHolder as never, [PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT]],
			[PaymentAccountHolderResolver.prototype.verifyPaymentAccountHolder as never, [PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT]],
			[PaymentAccountHolderResolver.prototype.deletePaymentAccountHolder as never, [PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT]],
			[PaymentMethodTokenResolver.prototype.createPaymentMethodToken as never, [PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT]],
			[PaymentMethodTokenResolver.prototype.setDefaultPaymentMethodToken as never, [PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT]],
			[PaymentMethodTokenResolver.prototype.revokePaymentMethodToken as never, [PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT]]
		];

		for (const [handler, expected] of writes) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual(expected);
		}
	});

	it('states a permission on the two fields whose own class states none', () => {
		/*
		 * The control that matters here is the *class*, not the field. Neither resolver class carries a
		 * class-level `@Permissions`, and `PermissionGuard` answers `true` when the metadata it reads is
		 * empty — so a field that states nothing of its own is a field the guard chain does not constrain
		 * at all, whatever its parent query requires. Asserting only that the two fields carry a
		 * permission would still pass against a broken implementation that had put the *wrong* one there,
		 * so the expected values are the grants the contract gives the rows each field returns:
		 * `PAYMENT_METHOD_TOKENS_VIEW` for both — the masked instruments are that resource on both
		 * surfaces, and `PaymentMethodToken.token`'s extra requirement is the charge gate inside the
		 * method body, asserted separately below.
		 */
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PaymentAccountHolderResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PaymentMethodTokenResolver)).toBeUndefined();

		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, PaymentAccountHolderResolver.prototype.methodTokens)
		).toEqual([PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW]);

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PaymentMethodTokenResolver.prototype.token)).toEqual([
			PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW
		]);
	});

	it('declares each root field on the resolver the schema names it on', () => {
		const tokenSource = readFileSync(join(__dirname, 'payment-method-token.resolver.ts'), 'utf8');
		const accountSource = readFileSync(join(__dirname, 'payment-account-holder.resolver.ts'), 'utf8');

		for (const declaration of [
			"@Query('paymentMethodTokens')",
			"@Query('paymentMethodToken')",
			"@Mutation('createPaymentMethodToken')",
			"@Mutation('setDefaultPaymentMethodToken')",
			"@Mutation('revokePaymentMethodToken')"
		]) {
			expect(tokenSource).toContain(declaration);
		}

		for (const declaration of [
			"@Query('paymentAccountHolders')",
			"@Query('paymentAccountHolder')",
			"@Mutation('createPaymentAccountHolder')",
			"@Mutation('updatePaymentAccountHolder')",
			"@Mutation('verifyPaymentAccountHolder')",
			"@Mutation('deletePaymentAccountHolder')",
			"@ResolveField('methodTokens')"
		]) {
			expect(accountSource).toContain(declaration);
		}
	});
});

describe('PaymentMethodTokenResolver — the gate on the stored reference (17 §6.4)', () => {
	it('declares the field gated on the charge permission', () => {
		expect(
			Reflect.getMetadata(VISIBLE_WITH_METADATA, PaymentMethodTokenResolver.prototype, 'token')
		).toBe(PaymentPermission.PAYMENT_METHOD_TOKENS_CHARGE);
	});

	it('answers the reference for a caller that may charge the instrument', async () => {
		const { tokenResolver } = surfaces([PaymentPermission.PAYMENT_METHOD_TOKENS_CHARGE]);

		await expect(tokenResolver.token(instrument)).resolves.toBe(REFERENCE);
	});

	it('answers the field with the typed denial for a caller that may not charge it', async () => {
		const { tokenResolver } = surfaces([]);

		// A GraphQL field declared nullable resolves to `null` with the typed error appended, which is
		// the contract's shape for a withheld field: `data.paymentMethodToken.token === null` and one
		// `errors` entry whose `path` is `['paymentMethodToken', 'token']`.
		await expect(tokenResolver.token(instrument)).rejects.toMatchObject({
			code: 'PERMISSION_DENIED',
			status: 403,
			details: {
				resource: 'paymentMethodToken',
				field: 'token',
				requiredPermission: PaymentPermission.PAYMENT_METHOD_TOKENS_CHARGE
			},
			message: "Field 'PaymentMethodToken.token' is not readable by this caller."
		});
	});

	it('never carries the reference in a list, for any caller', async () => {
		const { tokenResolver, accountResolver } = surfaces([PaymentPermission.PAYMENT_METHOD_TOKENS_CHARGE]);

		const connection = await tokenResolver.paymentMethodTokens({ accountHolderId: HOLDER });

		expect(Object.prototype.hasOwnProperty.call(connection.nodes[0], 'token')).toBe(false);
		expect(JSON.stringify(connection)).not.toContain(REFERENCE);

		const related = await accountResolver.methodTokens({ id: HOLDER } as never);

		expect(Object.prototype.hasOwnProperty.call(related[0], 'token')).toBe(false);
		expect(JSON.stringify(related)).not.toContain(REFERENCE);
	});
});

describe('the stored-instrument mutations (17 §9.7)', () => {
	it('refuses a card member smuggled into a declared free-form member', async () => {
		const { tokenResolver, kernel } = surfaces();

		await expect(
			tokenResolver.createPaymentMethodToken({
				accountHolderId: HOLDER,
				providerKey: 'a-provider',
				token: REFERENCE,
				providerConfirmation: { token: REFERENCE, confirmedAt: new Date() },
				metadata: { card: { number: '4242424242424242' } }
			} as never)
		).rejects.toMatchObject({
			response: {
				statusCode: 400,
				code: PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED,
				details: { field: 'metadata.card.number' }
			}
		});
		// The refusal is a validation failure: the request never reaches the provider adapter or a table.
		expect(kernel.recordProviderInstrument).not.toHaveBeenCalled();
	});

	it('answers a business rejection as a payload rather than as a transport error', async () => {
		const { tokenResolver, kernel } = surfaces();

		kernel.setDefaultToken.mockRejectedValueOnce(new BadRequestException('PAYMENT_METHOD_TOKEN_REVOKED: removed.'));

		await expect(tokenResolver.setDefaultPaymentMethodToken(TOKEN)).resolves.toMatchObject({
			paymentMethodToken: null,
			userErrors: [{ code: 'PAYMENT_METHOD_TOKEN_REVOKED' }]
		});
	});

	it('reports the instrument a default change displaced and the count a disable revoked', async () => {
		const { tokenResolver, accountResolver, kernel } = surfaces();

		const changed = await tokenResolver.setDefaultPaymentMethodToken(TOKEN);

		expect(changed).toMatchObject({ paymentMethodToken: { id: TOKEN }, previousDefaultId: undefined });
		expect(kernel.setDefaultToken).toHaveBeenCalledWith(TOKEN);

		const disabled = await accountResolver.deletePaymentAccountHolder(HOLDER);

		expect(disabled).toMatchObject({
			paymentAccountHolder: { id: HOLDER, status: 'DISABLED' },
			deleted: true,
			revokedTokenCount: 1
		});
	});
});

describe('the stored-instrument mutations — the retry declaration (17 §6.1)', () => {
	/** The retry declaration a mutation carries, as the kernel's interceptor reads it. */
	const declarationOf = (resolver: { prototype: object }, handler: string) =>
		Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (resolver.prototype as never)[handler]);

	it('requires a key on recording an account, on recording its verification, and on saving an instrument', () => {
		// The three mutations write at a provider as well as in a table, so a retry that lost its answer
		// must be given the first answer back rather than repeat the write.
		expect(declarationOf(PaymentAccountHolderResolver, 'createPaymentAccountHolder')).toEqual({
			scope: 'payment.account.create',
			required: true,
			resourceType: 'payment_account_holder'
		});
		expect(declarationOf(PaymentAccountHolderResolver, 'verifyPaymentAccountHolder')).toEqual({
			scope: 'payment.account.verify',
			required: true,
			resourceType: 'payment_account_holder'
		});
		expect(declarationOf(PaymentMethodTokenResolver, 'createPaymentMethodToken')).toEqual({
			scope: 'payment.instrument.create',
			required: true,
			resourceType: 'payment_method_token'
		});
	});

	it('leaves the mutations that repair a row without one', () => {
		// A repair writes what the caller states over a row the caller named, so a repeat is not a second
		// side effect and the mutation is untouched by the convention.
		expect(declarationOf(PaymentAccountHolderResolver, 'updatePaymentAccountHolder')).toBeUndefined();

		for (const handler of ['setDefaultPaymentMethodToken', 'revokePaymentMethodToken']) {
			expect(declarationOf(PaymentMethodTokenResolver, handler)).toBeUndefined();
		}
	});
});
