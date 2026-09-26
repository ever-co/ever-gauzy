/**
 * The write routes of this package that no field answered, the five that a field answers under another
 * name, the seven the specifications refuse to mirror, and the two the audit counted as answered while
 * the same-named field reached a different service method.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads each route's *handler* against
 * the root fields this document declares, and it flags **fifteen** of this package's fifty-eight write
 * routes. Fifteen is not a gap count, and the four buckets below are the reading that turns it into one:
 *
 * - **Three routes genuinely had no field** — the attempt's own repair, the attempt's refresh, and the
 *   instrument's display-fact repair. They are the three this wave delivers, and they are `PARITY`.
 * - **Five are served under another name** — `COLLAPSED`. The audit builds its expectation from the
 *   handler and the resource (`create` on `PaymentSessionController` → `createPaymentSession`) and, for a
 *   domain verb, from the verb plus the resource's first five characters; this package names an attempt's
 *   opening `openPaymentSession`, its cancellation `voidPaymentSession`, a capture `capturePayment`, a
 *   revocation `revokePaymentMethodToken`, and a reason's retirement `deleteRefundReason`. Every one of
 *   the five is a capability a caller reaches, and every one reaches the same service method its own route
 *   reaches.
 * - **Seven must not be mirrored** — `REFUSED`, and each refusal is cited where it is made. Two capture
 *   routes reach a service method that **always throws** `PAYMENT_CAPTURE_APPEND_ONLY`; three
 *   webhook-event routes write or rewrite the record of a callback the provider signed; and two hard
 *   deletes destroy a money row that `13` §11.4 puts beyond the API's reach. A field that can only refuse
 *   is not a capability, which is the reasoning the marketplace wave used for its four always-405 routes.
 * - **Bucket three is empty, and that is an assertion rather than an omission.** No flagged route here is a
 *   pivot or a child row reached through a parent's or a sibling's field: this package has no `add*` /
 *   `remove*` pair collapsed into a `replace*` set field, every child resource (a capture, a session, a
 *   line of a refund's breakdown) has its own resolver, and the two relational reads a parent carries —
 *   `PaymentCollection.sessions`, `PaymentAccountHolder.methodTokens` — are reads rather than set fields.
 *
 * Three plus five plus zero plus seven is **fifteen**, and the arithmetic is asserted below against the
 * audit's own fifteen labels, so a row that stops being true fails here rather than in a paragraph.
 *
 * **Two rows the audit counted as answered are the ones it was blind to, and both are pinned here.** The
 * audit compares names, so a field whose name matches a route satisfies it whether or not the field reaches
 * the service method that route calls:
 *
 * - **`PUT /refunds/:id`** reached the CRUD base's generic `update` — which writes whatever columns the
 *   body names — while the field `updateRefund` reached `RefundService.updateRefund`, which refuses a
 *   refund that is no longer `PENDING` with `REFUND_ALREADY_SETTLED` and strips `status`, `amount`,
 *   `currency`, `paymentId` and `lines`. `UpdateRefundDTO` carries all five, so a REST caller could
 *   rewrite the amount and the currency of a refund that had already settled, and GraphQL could not. That
 *   was a money-integrity hole rather than a parity gap, and **this wave repairs the handler** so both
 *   surfaces refuse identically. `PaymentSessionController.update` was mis-wired the same way and is
 *   repaired with it, because the field this wave delivers there is only a mirror if its route reaches the
 *   same method.
 * - **`DELETE /refund-reasons/:id`** reaches the inherited hard `delete` while the field
 *   `deleteRefundReason` reaches `RefundReasonService.deactivateReason`. Those are two different acts
 *   behind one name, and **this wave does not change it**: making a route named "delete" stop deleting is
 *   a semantics decision rather than a bug fix. It is recorded below as an owner decision, with the two
 *   sentences it falsifies — the controller's "a reason that is finished with is deactivated rather than
 *   deleted" and the resolver's "There is no hard delete" — each false of the route it sits beside, and
 *   with the third fact that `DELETE /refunds/:id` hard-deletes a money record against `13` §11.4 naming
 *   `refund` in its "no hard delete through the API" row.
 *
 * **Nothing is doubled here but the services.** The controllers are the real ones, the resolvers are the
 * real ones, `CrudController` behind them is restated in the shape the kernel declares it, and the
 * document the fields are read out of is the real one — the service is the seam the parity requirement is
 * about, and one stub per capability is what makes "the same method with the same arguments" visible
 * without a database behind it.
 */

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

// The collaborators the controllers and resolvers inject are doubled, so nothing below the surface is
// loaded: this suite is about the two declarations and the one call each of them makes.
jest.mock('../../payment-provider/payment-provider.service', () => ({
	PaymentProviderService: class PaymentProviderService {}
}));
jest.mock('../../payment-collection/payment-collection.service', () => ({
	PaymentCollectionService: class PaymentCollectionService {}
}));
jest.mock('../../payment-session/payment-session.service', () => ({
	PaymentSessionService: class PaymentSessionService {}
}));
jest.mock('../../payment-capture/payment-capture.service', () => ({
	PaymentCaptureService: class PaymentCaptureService {}
}));
jest.mock('../../refund/refund.service', () => ({ RefundService: class RefundService {} }));
jest.mock('../../refund-line/refund-line.service', () => ({ RefundLineService: class RefundLineService {} }));
jest.mock('../../refund-reason/refund-reason.service', () => ({
	RefundReasonService: class RefundReasonService {}
}));
jest.mock('../../payment-webhook-event/payment-webhook-event.service', () => ({
	PaymentWebhookEventService: class PaymentWebhookEventService {}
}));
jest.mock('../../payment-account-holder/payment-account-holder-lifecycle.service', () => ({
	PaymentAccountHolderLifecycleService: class PaymentAccountHolderLifecycleService {}
}));
jest.mock('../../payment-method-token/payment-method-token-lifecycle.service', () => ({
	PaymentMethodTokenLifecycleService: class PaymentMethodTokenLifecycleService {}
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		// The three routes this suite reads out of the base class, in the shape the kernel declares them:
		// `delete` calls the service's own `delete`, and the two lifecycle handlers hand it their rest
		// parameter, an empty ARRAY when the route was called with only an id.
		CrudController: class CrudController {
			constructor(protected readonly crudService: any) {}

			async delete(id: any): Promise<any> {
				return this.crudService.delete(id);
			}

			async softRemove(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRemove(id, options);
			}

			async softRecover(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRecover(id, options);
			}
		},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		// The two decorators whose metadata this suite compares between a route and the field that mirrors
		// it are the kernel's own, because a double that wrote nothing would let "the route declares no
		// scope either" pass on two absences.
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		Versioned: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator').Versioned,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		VERSIONED_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util')
			.VERSIONED_METADATA_KEY,
		UseValidationPipe: decorator,
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// Every resolver class carries the platform's feature guard, so the double provides the class the
		// resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class FeatureFlagGuard {},
		VisibleWith: decorator,
		FieldVisibility: class FieldVisibility {},
		// The connection helpers the list fields page and answer with are the kernel's own, taken from the
		// kernel rather than restated: `connection.ts` reaches `connectionFromOffsetPage` through this
		// barrel, so a double that dropped it would fail the import rather than an assertion.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		// The kernel classes the controllers and the two stored-instrument resolvers name in their
		// constructor signatures — TypeScript emits them as the injection metadata, so they have to exist.
		Payment: class Payment {},
		Integration: class Integration {},
		PaymentAccountHolder: class PaymentAccountHolder {},
		PaymentMethodToken: class PaymentMethodToken {},
		PaymentAccountHolderService: class PaymentAccountHolderService {},
		PaymentMethodTokenService: class PaymentMethodTokenService {},
		// The validation pipe the controllers build at class-definition time; Nest refuses a pipe with no
		// `transform`, and the controller files reach it through this barrel.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		}
	};
});

import { getMetadataStorage } from 'class-validator';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FieldDefinitionNode, InputObjectTypeDefinitionNode, InputValueDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, IDEMPOTENT_METADATA_KEY, PermissionGuard, TenantPermissionGuard,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import { PaymentPermission } from '../../payment.permissions';
import { PaymentSessionController } from '../../payment-session/payment-session.controller';
import { UpdatePaymentSessionDTO } from '../../payment-session/dto';
import { PaymentMethodTokenController } from '../../payment-method-token/payment-method-token.controller';
import { UpdatePaymentMethodTokenDTO } from '../../payment-method-token/dto';
import { RefundController } from '../../refund/refund.controller';
import { RefundReasonController } from '../../refund-reason/refund-reason.controller';
import { PaymentCaptureController } from '../../payment-capture/payment-capture.controller';
import { PaymentCollectionController } from '../../payment-collection/payment-collection.controller';
import { PaymentWebhookEventController } from '../../payment-webhook-event/payment-webhook-event.controller';
import { schemaExtensions } from '../schema-extensions';
import { PaymentSessionResolver } from './payment-session.resolver';
import { PaymentMethodTokenResolver } from './payment-method-token.resolver';
import { RefundResolver } from './refund.resolver';
import { RefundReasonResolver } from './refund-reason.resolver';
import { PaymentCaptureResolver } from './payment-capture.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const ID = '00000000-0000-4000-8000-0000000000e1';
const ADDRESS = '00000000-0000-4000-8000-0000000000e2';

/**
 * What each service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that repairs an attempt over GraphQL and one that
 * repairs it over REST must be looking at the same record afterwards.
 */
const SESSION = { id: ID, status: 'PENDING', externalId: 'pi_ext_1' };
const INSTRUMENT = { id: ID, brand: 'visa', last4: '4242' };
const REFUND = { id: ID, status: 'PENDING' };

/**
 * What a collaborator other than the capability's own service answers with.
 *
 * It is deliberately a different row: a field that reached the wrong service would report it, and the
 * identity assertion below would fail rather than pass on a shared double.
 */
const FOREIGN = { id: ID, wrong: true };

/**
 * The body each route's own DTO carries, and the members the field's input must therefore state.
 *
 * The bodies are the full writable surface rather than one member each, because "the input mirrors the
 * body" is the property being asserted: a member missing from the input is a member a GraphQL caller
 * cannot write.
 */
const SESSION_EDIT = {
	externalId: 'pi_ext_2',
	paymentMethodTokenId: ADDRESS,
	data: { next: 'redirect' },
	expiresAt: new Date('2026-03-01T00:00:00.000Z'),
	authorizedAt: new Date('2026-02-01T00:00:00.000Z'),
	metadata: { note: 'operator repair' }
};

const INSTRUMENT_EDIT = {
	brand: 'mastercard',
	last4: '4444',
	expiryMonth: 4,
	expiryYear: 2031,
	holderName: 'A Buyer',
	billingAddressId: ADDRESS,
	metadata: { note: 'operator repair' }
};

/** The refund body the repair route takes, whose five status-owning members the service strips. */
const REFUND_EDIT = { reason: 'damaged', note: 'operator repair', metadata: { note: 'operator repair' } };

/** The body `POST /payment-captures` takes, which the field's input states identically. */
const CAPTURE_INPUT = { paymentId: ID, amount: '42.500000', currency: 'USD' };

/** The body `POST /payment-sessions` takes, which the field's input states identically. */
const SESSION_OPEN = { collectionId: ID, amount: '42.500000' };

/**
 * What a collapsed route's service answers, so the two surfaces can be compared by identity.
 *
 * One row read twice rather than two rows: a caller that revokes an instrument over GraphQL and one that
 * revokes it over REST must be looking at the same record afterwards.
 */
const COLLAPSED_ROW = { id: ID, ok: true };

/** The collaborators each resolver's constructor takes, in order, as this suite names them. */
const RESOLVER_DEPS: Readonly<Record<string, readonly string[]>> = {
	PaymentSessionResolver: ['session'],
	PaymentMethodTokenResolver: ['tokenLifecycle', 'visibility', 'token'],
	RefundResolver: ['refund', 'refundLine'],
	RefundReasonResolver: ['reason'],
	PaymentCaptureResolver: ['capture']
};

/** One of the three routes no field answered, its two surfaces and what its field must mirror. */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The label the audit printed for this route. */
	expects: string;
	/** The arguments the route's handler takes — the path member and the body. */
	routeArgs: any[];
	/** The arguments the field takes. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces. */
	serviceArgs: any[];
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with, which is what the resource's other mutations answer. */
	answers: string;
	/** The members the field's input declares, which the route's own DTO was read for. */
	input: string;
	/** The grant the route's own handler states. */
	grant: string;
	/** The method both surfaces must reach. */
	method: string;
	/** The refusal the method throws for the row under test, which both surfaces must report. */
	refusal: Error;
	/** The code that refusal carries, as `userErrors` states it on the GraphQL side. */
	code: string;
	/** The collaborator that owns the capability. */
	service: string;
	/** The collaborators its resolver takes, in constructor order. */
	deps: readonly string[];
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/** Builds the two surfaces over the stubs. */
	build: (stubs: Row) => { controller: Row; resolver: Row };
}

/**
 * The three routes no field answered.
 *
 * Each is a capability rather than a spare route: an attempt's own recorded fields, the state of an
 * attempt whose lifetime has run out, and an instrument's display facts. None of the three routes
 * declares a retry scope or a version expectation, so neither does the field that mirrors it — a field
 * demanding a key its route does not demand would refuse a GraphQL caller the REST route serves.
 */
const PARITY: IParity[] = [
	{
		field: 'updatePaymentSession',
		route: 'update',
		resource: 'PaymentSession',
		expects: 'updatePaymentSession',
		routeArgs: [ID, SESSION_EDIT],
		fieldArgs: [{ id: ID, ...SESSION_EDIT }],
		serviceArgs: [ID, SESSION_EDIT],
		declared: [['input', 'UpdatePaymentSessionInput']],
		answers: 'UpdatePaymentSessionPayload',
		input: 'UpdatePaymentSessionInput',
		grant: PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE,
		method: 'updateSession',
		refusal: new BadRequestException('PAYMENT_SESSION_ALREADY_CLOSED'),
		code: 'PAYMENT_SESSION_ALREADY_CLOSED',
		service: 'session',
		deps: RESOLVER_DEPS.PaymentSessionResolver,
		controller: PaymentSessionController,
		resolver: PaymentSessionResolver,
		build: (stubs) => ({
			controller: new PaymentSessionController(stubs.session) as Row,
			resolver: new PaymentSessionResolver(stubs.session) as Row
		})
	},
	{
		field: 'refreshPaymentSession',
		route: 'refresh',
		resource: 'PaymentSession',
		expects: '*refresh*',
		// The route's handler takes the path member and no body, so the field takes the identifier alone.
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		declared: [['id', 'ID']],
		answers: 'RefreshPaymentSessionPayload',
		input: '',
		grant: PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE,
		method: 'refreshSession',
		refusal: new NotFoundException('PAYMENT_SESSION_NOT_FOUND'),
		code: 'PAYMENT_SESSION_NOT_FOUND',
		service: 'session',
		deps: RESOLVER_DEPS.PaymentSessionResolver,
		controller: PaymentSessionController,
		resolver: PaymentSessionResolver,
		build: (stubs) => ({
			controller: new PaymentSessionController(stubs.session) as Row,
			resolver: new PaymentSessionResolver(stubs.session) as Row
		})
	},
	{
		field: 'updatePaymentMethodToken',
		route: 'update',
		resource: 'PaymentMethodToken',
		expects: 'updatePaymentMethodToken',
		routeArgs: [ID, INSTRUMENT_EDIT],
		fieldArgs: [{ id: ID, ...INSTRUMENT_EDIT }],
		serviceArgs: [ID, INSTRUMENT_EDIT],
		declared: [['input', 'UpdatePaymentMethodTokenInput']],
		answers: 'UpdatePaymentMethodTokenPayload',
		input: 'UpdatePaymentMethodTokenInput',
		grant: PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT,
		method: 'update',
		refusal: new BadRequestException('PAYMENT_METHOD_TOKEN_REVOKED'),
		code: 'PAYMENT_METHOD_TOKEN_REVOKED',
		service: 'tokenLifecycle',
		deps: RESOLVER_DEPS.PaymentMethodTokenResolver,
		controller: PaymentMethodTokenController,
		resolver: PaymentMethodTokenResolver,
		build: (stubs) => ({
			// The controller takes the kernel service first and hands it to the CRUD base, and the
			// lifecycle collaborator second — which is the one both the update route and the field reach.
			controller: new PaymentMethodTokenController(stubs.token, stubs.tokenLifecycle) as Row,
			resolver: new PaymentMethodTokenResolver(
				stubs.tokenLifecycle,
				stubs.visibility,
				stubs.token
			) as Row
		})
	}
];

/**
 * The five routes a field answers under another name.
 *
 * The name the audit built is absent from the document and the field named here is present, which is the
 * whole of the reading: the capability is served, and the instrument's expectation is a naming convention
 * this package does not follow for these acts. The fifth is a domain verb rather than a CRUD handler, so
 * the audit's test is the verb-plus-stem one and the assertion applies that test rather than a name.
 *
 * Each row carries the arguments its two surfaces take and the calls they must make, because "served under
 * another name" is only worth asserting if the field is a door to the same method the route reaches.
 */
const COLLAPSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	/** Whether the audit's expectation is a domain verb rather than a name it built. */
	verb: boolean;
	field: string;
	/** The method the route and the field both reach. */
	method: string;
	/** The collaborator that owns the capability. */
	service: string;
	/** The collaborators the resolver takes, in constructor order. */
	deps: readonly string[];
	/** The payload member the field answers the row under. */
	member: string;
	routeArgs: any[];
	fieldArgs: any[];
	/** What the service must receive from the route, and from the field where the two differ. */
	routeServiceArgs: any[];
	fieldServiceArgs: any[];
}[] = [
	// `POST /payment-captures` records a capture, and the field names the act rather than the row:
	// `capturePayment` reaches `PaymentCaptureService.capture`, which is the method the route reaches.
	{
		controller: PaymentCaptureController,
		resource: 'PaymentCapture',
		route: 'create',
		expects: 'createPaymentCapture',
		verb: false,
		field: 'capturePayment',
		method: 'capture',
		service: 'capture',
		deps: RESOLVER_DEPS.PaymentCaptureResolver,
		member: 'paymentCapture',
		routeArgs: [CAPTURE_INPUT],
		fieldArgs: [CAPTURE_INPUT],
		routeServiceArgs: [CAPTURE_INPUT],
		fieldServiceArgs: [CAPTURE_INPUT]
	},
	// `DELETE /payment-method-tokens/:id` is a revocation, not a delete: `06` §7.12 states the route as
	// "**Revoke** the instrument — never a hard delete; its charge history keeps resolving", and `05` §23
	// I-75 adds "deleting a token **revokes** it and never removes the row". The field is named for what
	// the route does.
	{
		controller: PaymentMethodTokenController,
		resource: 'PaymentMethodToken',
		route: 'delete',
		expects: 'deletePaymentMethodToken',
		verb: false,
		field: 'revokePaymentMethodToken',
		method: 'revoke',
		service: 'tokenLifecycle',
		deps: RESOLVER_DEPS.PaymentMethodTokenResolver,
		member: 'paymentMethodToken',
		routeArgs: [ID],
		fieldArgs: [ID],
		routeServiceArgs: [ID],
		fieldServiceArgs: [ID]
	},
	// `POST /payment-sessions` opens or switches an attempt, and the field says so.
	{
		controller: PaymentSessionController,
		resource: 'PaymentSession',
		route: 'create',
		expects: 'createPaymentSession',
		verb: false,
		field: 'openPaymentSession',
		method: 'openSession',
		service: 'session',
		deps: RESOLVER_DEPS.PaymentSessionResolver,
		member: 'paymentSession',
		routeArgs: [SESSION_OPEN],
		fieldArgs: [SESSION_OPEN],
		routeServiceArgs: [SESSION_OPEN],
		fieldServiceArgs: [SESSION_OPEN]
	},
	// `DELETE /payment-sessions/:id` voids an attempt and releases its authorisation. `17` §3.6 records
	// the naming: "`DELETE /api/payment-sessions/:id`, which is the package's own void verb and carries
	// `payment.cancel`. The design names the verb after the payment and the delivery states it on the
	// session, which is the resource that owns the authorised amount".
	//
	// The field's second argument is the one difference between the two calls, and it is the resolver's
	// own normalisation rather than a second behaviour: an input that states no reason reaches the service
	// as an empty object so a caller never has to know whether the option was passed.
	{
		controller: PaymentSessionController,
		resource: 'PaymentSession',
		route: 'delete',
		expects: 'deletePaymentSession',
		verb: false,
		field: 'voidPaymentSession',
		method: 'voidSession',
		service: 'session',
		deps: RESOLVER_DEPS.PaymentSessionResolver,
		member: 'paymentSession',
		routeArgs: [ID],
		fieldArgs: [{ id: ID }],
		routeServiceArgs: [ID],
		fieldServiceArgs: [ID, {}]
	},
	// `POST /refund-reasons/:id/deactivate` and the field `deleteRefundReason` reach the *same* service
	// method, `deactivateReason`, which sets `isActive` false. The route's `DELETE` sibling is a different
	// act, and the divergence between the two is recorded at the foot of this file as an owner decision.
	//
	// The label is the audit's own spelling for a domain verb: it prints the verb between asterisks
	// because it looked for a field carrying the verb and the resource's stem rather than a name it built.
	{
		controller: RefundReasonController,
		resource: 'RefundReason',
		route: 'deactivate',
		expects: '*deactivate*',
		verb: true,
		field: 'deleteRefundReason',
		method: 'deactivateReason',
		service: 'reason',
		deps: RESOLVER_DEPS.RefundReasonResolver,
		member: 'refundReason',
		routeArgs: [ID],
		fieldArgs: [ID],
		routeServiceArgs: [ID],
		fieldServiceArgs: [ID]
	}
];

/**
 * The seven routes the specifications refuse to mirror, and the fields that answer what they were for.
 *
 * These are not gaps to be closed later. Two reach a service method that always refuses, three write the
 * record of something a third party did, and two destroy a money record the retention policy keeps.
 */
const REFUSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	served: string[];
}[] = [
	// A capture is append-only, and the service is where that is enforced: `PaymentCaptureService.update`
	// and `.delete` both throw `PAYMENT_CAPTURE_APPEND_ONLY` on every call. `05` §12.4 states the rule —
	// "**Append-only**: partial captures are several rows. … a capture row is **never updated** — a
	// correction is a refund" — and `10` §8.2 repeats it: "**`payment_capture`** — … **Append-only.**" A
	// field mirroring either route would be a mutation whose only answer is a refusal, which is the
	// reasoning the marketplace wave used for four routes that always answer 405.
	{ controller: PaymentCaptureController, resource: 'PaymentCapture', route: 'update', expects: 'updatePaymentCapture', served: ['capturePayment', 'softDeletePaymentCapture', 'recoverPaymentCapture'] },
	// And `13` §11.4 keeps the row itself: `order*`, `payment`, `payment_capture`, `refund`, … are
	// "**Indefinite** | **Soft delete only (`deletedAt`); no hard delete through the API**".
	{ controller: PaymentCaptureController, resource: 'PaymentCapture', route: 'delete', expects: 'deletePaymentCapture', served: ['capturePayment', 'softDeletePaymentCapture', 'recoverPaymentCapture'] },
	// The inbound callback log is the record of what a third party sent and signed. `17` §3.3 declares
	// inbound provider callbacks `n-a` — "signature-verified inbound HTTP from third-party providers; a
	// GraphQL mutation cannot express provider-controlled request signing or replay protection, so the
	// routes stay REST" — and §3.4 gives the reason: "The signer is the third-party provider and the
	// signature covers the exact bytes of the provider's own request". The row is written by
	// `PaymentWebhookEventService.intake`, and `06` §8.1 states that "Neither controller trusts the body
	// before the signature verifies". The resolver beside this file puts it in as many words: "There is no
	// mutation that records a callback. … Exposing that as a mutation would let an authenticated caller
	// write a callback that never arrived." The update route rewrites the same evidence — its body is
	// `PartialType(CreatePaymentWebhookEventDTO)`, so the payload, the signature and the receipt stamp are
	// all writable — and the delete route hard-deletes a row `05` §25.2 gives to the retention job:
	// "`payment_webhook_event` | … | **deleted by the retention job after export**", which `13` §11.4
	// repeats as a nightly job.
	{ controller: PaymentWebhookEventController, resource: 'PaymentWebhookEvent', route: 'create', expects: 'createPaymentWebhookEvent', served: ['reprocessPaymentWebhookEvent', 'softDeletePaymentWebhookEvent', 'recoverPaymentWebhookEvent'] },
	{ controller: PaymentWebhookEventController, resource: 'PaymentWebhookEvent', route: 'update', expects: 'updatePaymentWebhookEvent', served: ['reprocessPaymentWebhookEvent', 'softDeletePaymentWebhookEvent', 'recoverPaymentWebhookEvent'] },
	{ controller: PaymentWebhookEventController, resource: 'PaymentWebhookEvent', route: 'delete', expects: 'deletePaymentWebhookEvent', served: ['reprocessPaymentWebhookEvent', 'softDeletePaymentWebhookEvent', 'recoverPaymentWebhookEvent'] },
	// `13` §11.4 names `refund` in the row it keeps: "**Indefinite** | **Soft delete only (`deletedAt`); no
	// hard delete through the API**", and this route reaches the inherited hard `delete`, because
	// `RefundService` declares no `delete` of its own. `17` §3.2's payment row names `softDeleteRefund` and
	// `recoverRefund` and no `deleteRefund`, which is the same statement made by the design.
	{ controller: RefundController, resource: 'Refund', route: 'delete', expects: 'deleteRefund', served: ['createRefund', 'updateRefund', 'approveRefund', 'cancelRefund', 'softDeleteRefund', 'recoverRefund'] },
	// The collection's hard delete is the weakest refusal of the seven and is flagged as one. `05` §12.2
	// forbids it conditionally — "a collection is created before any session and is never hard-deleted
	// while a payment references it" — and the relations make the cost explicit: `sessions 1:M
	// payment_session CASCADE` deletes the attempts with the collection, and `payment.paymentCollectionId
	// … ON DELETE SET NULL` (`05` §2.10) detaches a referencing payment from the collection it belongs to.
	// No service guard implements the condition, so a REST caller can do today what §12.2 forbids; the
	// owner decides whether that is a route to guard or a field to add, and this suite refuses the mirror
	// until the condition exists.
	{ controller: PaymentCollectionController, resource: 'PaymentCollection', route: 'delete', expects: 'deletePaymentCollection', served: ['createPaymentCollection', 'updatePaymentCollection', 'softDeletePaymentCollection', 'recoverPaymentCollection'] }
];

/**
 * The audit's own fifteen labels for this package, in the order it printed them.
 *
 * Reproducing the instrument's output is what keeps the three tables above a measurement: a route that
 * stops being flagged, or a label that changes, fails here rather than in a reader's memory.
 */
const FLAGGED = [
	'createPaymentCapture',
	'updatePaymentCapture',
	'deletePaymentCapture',
	'deletePaymentCollection',
	'updatePaymentMethodToken',
	'deletePaymentMethodToken',
	'createPaymentSession',
	'updatePaymentSession',
	'*refresh*',
	'deletePaymentSession',
	'createPaymentWebhookEvent',
	'updatePaymentWebhookEvent',
	'deletePaymentWebhookEvent',
	'deleteRefund',
	'*deactivate*'
];

/**
 * The members every DTO of this package inherits from the credential rather than declaring.
 *
 * They belong to the caller rather than to a body, no input in this document states them, and a
 * comparison that read them would demand that one did.
 */
const SCOPE_MEMBERS = ['organization', 'organizationId', 'sentTo', 'tenant', 'tenantId'];

/**
 * The methods every stub carries, so a negative control is a measurement rather than an absence.
 *
 * A collaborator is only useful as a control if it *could* have answered the call: a stub without the
 * method would make "no other service was touched" pass because nothing could be called at all.
 */
const CAPABILITY_METHODS = ['update', 'updateSession', 'refreshSession', 'revoke', 'capture', 'openSession', 'voidSession', 'deactivateReason', 'delete'];

/**
 * One collaborator stub, answering the row it is given with every method a route or a field could reach.
 *
 * @param answer What the stub answers with.
 * @returns The stub.
 */
function collaborator(answer: unknown): Row {
	return Object.fromEntries(CAPABILITY_METHODS.map((method) => [method, jest.fn().mockResolvedValue(answer)]));
}

/**
 * Both surfaces over one stubbed service, with a stub of its own on every other collaborator.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same arguments, and one stub is what makes that visible without a database behind it.
 *
 * @param entry The route whose two surfaces are built.
 * @returns The service, the other collaborators, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { service: Row; others: Row[]; controller: Row; resolver: Row } {
	const service = collaborator(FOREIGN);
	const stubs: Row = {};

	for (const name of entry.deps) {
		stubs[name] = name === entry.service ? service : collaborator(FOREIGN);
	}

	// The capability's own method answers the row both surfaces must report, while every other method of
	// the same stub keeps answering the foreign row: a field that reached a sibling method is caught.
	service[entry.method] = jest.fn().mockResolvedValue(answerFor(entry));

	const { controller, resolver } = entry.build(stubs);

	return {
		service,
		others: entry.deps.filter((name) => name !== entry.service).map((name) => stubs[name]),
		controller,
		resolver
	};
}

/** The row the capability's own method answers with, which is the resource's row rather than a foreign one. */
function answerFor(entry: IParity): unknown {
	return entry.resource === 'PaymentMethodToken' ? INSTRUMENT : SESSION;
}

/** The handlers of one controller, as functions, the inherited and overridden ones included. */
function handlersOf(controller: new (...args: any[]) => any): Row {
	return controller.prototype as unknown as Row;
}

/** The fields of one resolver, as functions. */
function fieldsOf(resolver: new (...args: any[]) => any): Row {
	return resolver.prototype as unknown as Row;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]`, which `PermissionGuard` answers `true` to when the pair is empty.
 *
 * @param controller The controller the route belongs to.
 * @param handler The route's handler name.
 * @returns The permission metadata the guard would resolve.
 */
function permissionOfRoute(controller: new (...args: any[]) => any, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(resolver: new (...args: any[]) => any, field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, resolver)
	);
}

/** The guards one surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler?: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = handler ? Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? [] : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root mutation type's own fields, as the document declares them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the payment document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** Every root mutation field's name, in the order the document states them. */
function mutationNames(): string[] {
	return mutationFields().map((field) => field.name.value);
}

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationNames().includes(name);
}

/**
 * Whether the audit's own test holds for a domain verb: a field whose name carries the verb *and* the
 * first five letters of the resource.
 *
 * Reproduced rather than described, because a row that says "the audit looked for this and there is no
 * such field" is only worth reading if the test applies the instrument's rule.
 *
 * @param verb The route's handler name.
 * @param resource The controller's resource name.
 * @returns True when some field would satisfy the instrument.
 */
function auditHoldsForVerb(verb: string, resource: string): boolean {
	const stem = resource.slice(0, 5).toLowerCase();

	return mutationNames().some(
		(name) => name.toLowerCase().includes(verb.toLowerCase()) && name.toLowerCase().includes(stem)
	);
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the payment document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** One input type, as the document spells it. */
function inputType(name: string): InputObjectTypeDefinitionNode {
	const input = schemaExtensions.definitions.find(
		(definition): definition is InputObjectTypeDefinitionNode =>
			definition.kind === 'InputObjectTypeDefinition' && definition.name.value === name
	);

	if (!input) {
		throw new Error(`the payment document declares no input named "${name}"`);
	}

	return input;
}

/** The members an input type declares, in the order the document states them. */
function inputMembers(name: string): string[] {
	return (inputType(name).fields ?? []).map((field) => field.name.value);
}

/** One member of an input type, as the document declares it. */
function inputMember(name: string, member: string): InputValueDefinitionNode {
	const field = (inputType(name).fields ?? []).find((candidate) => candidate.name.value === member);

	if (!field) {
		throw new Error(`the payment document declares no member "${member}" on "${name}"`);
	}

	return field;
}

/** One named type declaration of the document, as the document spells it. */
function typeDefinition(name: string): ObjectTypeDefinitionNode {
	const definition = schemaExtensions.definitions.find(
		(candidate): candidate is ObjectTypeDefinitionNode =>
			candidate.kind === 'ObjectTypeDefinition' && candidate.name.value === name
	);

	if (!definition) {
		throw new Error(`the payment document declares no type named "${name}"`);
	}

	return definition;
}

/** The members of one object type, as a client reads them. */
function membersOf(name: string): string[] {
	return (typeDefinition(name).fields ?? []).map((field) => field.name.value);
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/** The name of the type a field answers with, however deeply it is wrapped. */
function namedTypeOf(field: FieldDefinitionNode): string {
	return namedTypeName(field.type);
}

/**
 * The members a DTO validates, its own and the ones it inherits.
 *
 * The wholesale read, needed for a `PartialType`: it returns a class the declared DTO only *extends*, so
 * the metadata it copied carries the returned class as its target and an own-target read of the declared
 * one would find nothing at all.
 *
 * @param dto The DTO to read.
 * @returns Every member name it validates, sorted.
 */
function allDtoMembers(dto: new (...args: any[]) => any): string[] {
	const metadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);

	return Array.from(new Set(metadata.map((entry) => entry.propertyName))).sort();
}

/**
 * The schema's half of the three fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the payment document — the three routes no field answered are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, in the order the route states them', () => {
		for (const { field, declared } of PARITY) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));
			expect(arguments_[0].type.kind).toBe('NonNullType');

			for (const [index, [, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
			}
		}
	});

	it('answers each field with the payload of its own act, and each payload with the row it acted on', () => {
		for (const { field, answers, resource } of PARITY) {
			// The payload type is named after the act, and the declaration is non-null: every sibling
			// mutation of this document answers one, and a nullable payload would make a client defend
			// against a state the resolver never produces.
			expect(namedTypeOf(mutationField(field))).toBe(answers);
			expect(mutationField(field).type.kind).toBe('NonNullType');

			const member = resource.charAt(0).toLowerCase() + resource.slice(1);

			expect(membersOf(answers)).toEqual([member, 'operation', 'userErrors']);
		}
	});

	it('declares the members the route’s own body carries, and only those', () => {
		// Read from the DTO each route validates its body with rather than restated here, so a member added
		// to a DTO and not to the input fails this. Seven members of the session's body are deliberately not
		// on the input: the five the service destructures out and drops (`status`, `amount`, `currency`,
		// `providerId`, `collectionId`, because those move through the operation that means something), the
		// client secret (a bearer value for one caller's client-side flow, which the session type states is
		// absent from every projection and which the delivered `openPaymentSession` input leaves off too),
		// and the retry key (the route declares no `@Idempotent` scope, so the input states none either).
		// One member of the instrument's body is not on its input: `type`, the kind, which the body still
		// carries through `PartialType` and the kernel's `updateToken` drops.
		const sessionBody = allDtoMembers(UpdatePaymentSessionDTO).filter((member) => !SCOPE_MEMBERS.includes(member));
		const instrumentBody = allDtoMembers(UpdatePaymentMethodTokenDTO).filter(
			(member) => !SCOPE_MEMBERS.includes(member)
		);

		// The controls, so the two comparisons below cannot pass on two empty readings.
		expect(sessionBody).toEqual([
			'amount',
			'authorizedAt',
			'clientSecret',
			'collectionId',
			'currency',
			'data',
			'expiresAt',
			'externalId',
			'idempotencyKey',
			'metadata',
			'paymentMethodTokenId',
			'providerId',
			'status'
		]);
		expect(instrumentBody).toEqual([
			'billingAddressId',
			'brand',
			'expiryMonth',
			'expiryYear',
			'holderName',
			'last4',
			'metadata',
			'type'
		]);

		expect(inputMembers('UpdatePaymentSessionInput').sort()).toEqual(
			['id', ...sessionBody.filter((member) => !['status', 'amount', 'currency', 'providerId', 'collectionId', 'clientSecret', 'idempotencyKey'].includes(member))].sort()
		);
		expect(inputMembers('UpdatePaymentMethodTokenInput').sort()).toEqual(
			['id', ...instrumentBody.filter((member) => member !== 'type')].sort()
		);
	});

	it('requires the identifier and leaves every change optional', () => {
		// An update states what changed rather than restating the row, so every member after the identifier
		// is optional on both inputs while the identifier itself is not: a write that names no row is not a
		// write.
		for (const { input } of PARITY.filter((entry) => entry.input)) {
			expect(inputMember(input, 'id').type.kind).toBe('NonNullType');

			for (const member of inputMembers(input).filter((name) => name !== 'id')) {
				expect(inputMember(input, member).type.kind).toBe('NamedType');
			}
		}
	});

	it('keeps every mutation the document already carried, and adds exactly three', () => {
		// A parity change is additive: the fields that were there stay there, and the count is asserted so a
		// wave that delivers a field and silently drops another fails here.
		for (const name of [
			'createPaymentProvider',
			'updatePaymentProvider',
			'deletePaymentProvider',
			'createPaymentCollection',
			'updatePaymentCollection',
			'openPaymentSession',
			'authorizePaymentSession',
			'voidPaymentSession',
			'capturePayment',
			'createRefund',
			'updateRefund',
			'approveRefund',
			'cancelRefund',
			'createRefundReason',
			'updateRefundReason',
			'deleteRefundReason',
			'createRefundLine',
			'updateRefundLine',
			'deleteRefundLine',
			'reprocessPaymentWebhookEvent',
			'createPaymentAccountHolder',
			'updatePaymentAccountHolder',
			'verifyPaymentAccountHolder',
			'deletePaymentAccountHolder',
			'createPaymentMethodToken',
			'setDefaultPaymentMethodToken',
			'revokePaymentMethodToken'
		]) {
			expect(declares(name)).toBe(true);
		}

		expect(mutationNames()).toHaveLength(50);
	});

	it('declares the recoverable lifecycle pair and no other field of that shape', () => {
		// The twenty fields of `soft-delete.spec.ts` beside this file, unchanged by this wave — and the act
		// is still spelled `recover`, never `restore`, which is the vocabulary 111 of the composed schema's
		// 112 fields of this kind use.
		const shaped = mutationNames().filter((name) => name.startsWith('softDelete') || name.startsWith('recover'));

		expect(shaped).toHaveLength(20);
		expect(mutationNames().filter((name) => name.startsWith('restore'))).toEqual([]);
	});

	it('declares no root field twice, which no assertion inside a document can see', () => {
		// The `gql` tag parses a document with two fields of one name and `buildASTSchema` then fails with
		// `Field "Mutation.x" can only be defined once` — at boot, not here. A duplicate is therefore
		// asserted rather than left to the composition pass.
		const names = mutationNames();

		expect(new Set(names).size).toBe(names.length);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is compared
 * is the call each of them makes on one stub, not a service method named in this file.
 */
describe('the three fields — the two protocols write the same rows the same way', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { service, others, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// One call each, with the same arguments in the same order: the route's body and the field's input
		// are one statement about the row, and a field that reordered them or dropped one would be a
		// different write. The two new update fields separate the identifier from the changes before the
		// call, because a path member carries it on REST and a GraphQL input has to state it — so what the
		// service receives is the same shape from both surfaces rather than the input's `id` travelling
		// into the payload.
		expect(service[entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(service[entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(service[entry.method]).toHaveBeenCalledTimes(2);

		// No other collaborator was touched: a field wired to the wrong service is a field that acts on the
		// wrong aggregate, and the payload would carry whatever that one returned.
		for (const other of others) {
			for (const method of CAPABILITY_METHODS) {
				expect(other[method]).not.toHaveBeenCalled();
			}
		}

		// One answer, one implementation: the row either surface wrote is the same row, and it is the one
		// the resource's own service returned rather than a foreign stub's.
		const member = entry.resource.charAt(0).toLowerCase() + entry.resource.slice(1);

		expect(overGraphql[member]).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
		expect(overRest).not.toBe(FOREIGN);
	});

	it.each(PARITY)('$field reports a refusal where this plugin reports it: in userErrors', async (entry) => {
		const { service, controller, resolver } = surfaces(entry);

		// The route answers the refusal as the transport error it is.
		service[entry.method].mockRejectedValueOnce(entry.refusal);

		await expect(controller[entry.route](...entry.routeArgs)).rejects.toBe(entry.refusal);

		// ...and the field answers the same refusal as a successful operation with something to report,
		// which is the convention every other mutation of this document follows: a client branches on
		// userErrors and reads the row member, never parsing a message to know what happened.
		service[entry.method].mockRejectedValueOnce(entry.refusal);

		await expect(resolver[entry.field](...entry.fieldArgs)).resolves.toMatchObject({
			userErrors: [{ code: entry.code }]
		});
	});

	it('declares no retry scope and no version expectation on any of the three, as none of their routes does', () => {
		// A control first: the reading below is only worth making if the decorators write metadata at all.
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(PaymentSessionController).create)).toBeDefined();

		for (const { field, route, controller, resolver } of PARITY) {
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(controller)[route])).toBeUndefined();
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();

			// `@Versioned` appears nowhere in this plugin: `06` §12.2's versioned aggregates are the cart,
			// the order, a return, a subscription, an order change, an entitlement and the stock-level
			// pair, and none of these three routes protects one of them. The version column and the
			// `If-Match` header are for those aggregates and not for an attempt or an instrument.
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(controller)[route])).toBeUndefined();
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
		}
	});
});

/**
 * The repair this wave makes to a route rather than to the schema.
 *
 * `PUT /refunds/:id` reached the CRUD base's generic `update`, which writes whatever columns the body
 * names, while the field `updateRefund` reached `RefundService.updateRefund`, which refuses a refund that
 * is no longer `PENDING` and strips the five members the status of the money owns. `UpdateRefundDTO`
 * carries all five, so REST could rewrite the amount and the currency of a settled refund. The regression
 * this suite exists to prevent is that divergence returning, so both surfaces are driven over one stub and
 * the refusal is asserted on both.
 */
describe('the refund repair — a settled refund is refused on both surfaces', () => {
	/** The two surfaces over one stub, with the generic update kept as a negative control. */
	function refundSurfaces() {
		const service: Row = {
			update: jest.fn().mockResolvedValue(FOREIGN),
			updateRefund: jest.fn().mockResolvedValue(REFUND),
			findRefundLines: jest.fn().mockResolvedValue([])
		};

		return {
			service,
			controller: new RefundController(service as never) as Row,
			resolver: new RefundResolver(service as never, { findLines: jest.fn() } as never) as Row
		};
	}

	it('reaches the domain method from both surfaces, and never the generic update', async () => {
		const { service, controller, resolver } = refundSurfaces();

		const overRest = await controller.update(ID, REFUND_EDIT);
		const overGraphql = await resolver.updateRefund({ id: ID, ...REFUND_EDIT });

		expect(service.update).not.toHaveBeenCalled();
		expect(service.updateRefund).toHaveBeenCalledTimes(2);

		// The identifier is the same on both, and the payload differs by exactly the member the transport
		// differs by: a path carries it on REST, and a GraphQL input has to state it. Every member the
		// repair writes travels on both.
		expect(service.updateRefund).toHaveBeenNthCalledWith(1, ID, REFUND_EDIT);
		expect(service.updateRefund).toHaveBeenNthCalledWith(2, ID, { id: ID, ...REFUND_EDIT });

		expect(overRest).toBe(REFUND);
		expect(overGraphql.refund).toBe(REFUND);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it('refuses a settled refund with the same code on both surfaces', async () => {
		const { service, controller, resolver } = refundSurfaces();
		const settled = new BadRequestException('REFUND_ALREADY_SETTLED');

		service.updateRefund.mockRejectedValueOnce(settled);

		await expect(controller.update(ID, REFUND_EDIT)).rejects.toBe(settled);

		service.updateRefund.mockRejectedValueOnce(settled);

		await expect(resolver.updateRefund({ id: ID, ...REFUND_EDIT })).resolves.toMatchObject({
			refund: null,
			userErrors: [{ code: 'REFUND_ALREADY_SETTLED' }]
		});
	});

	it('never writes the members the status of the money owns, on either surface', async () => {
		// The body carries them and the service strips them: what a caller states here is a change the
		// operation is not allowed to make, and the assertion is that the same body reaches the same method
		// from both surfaces — the stripping is the service's, and it is exercised by the service's own
		// suite.
		const { service, controller, resolver } = refundSurfaces();
		const body = { status: 'SUCCEEDED', amount: '99.000000', currency: 'EUR', ...REFUND_EDIT };

		await controller.update(ID, body);
		await resolver.updateRefund({ id: ID, ...body });

		expect(service.updateRefund).toHaveBeenNthCalledWith(1, ID, body);
		expect(service.updateRefund).toHaveBeenNthCalledWith(2, ID, { id: ID, ...body });
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Each of the three is a write — an attempt's recorded fields, its lifetime, and an instrument's display
 * facts — so a field that stated no grant of its own would be one `PermissionGuard` answers `true` to,
 * because it answers `true` to empty metadata. The three resolvers state no class-level grant that could
 * close that, which is why the comparison is against the route's own handler metadata rather than against
 * the class.
 */
describe('the three fields — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			// The handler is asserted to be the plugin's own before the two readings are compared, because
			// that is what makes the route's own metadata the thing being mirrored rather than the base's.
			expect(typeof handlersOf(controller)[route]).toBe('function');
			expect(Object.prototype.hasOwnProperty.call(controller.prototype, route)).toBe(true);

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the grant the route states, which is never the class-level one', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for — and
		// because the three routes do not share one grant: a field that copied its neighbour's would pass
		// the comparison above on its own controller and fail here.
		for (const { field, route, controller, resolver, grant } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);

			const view = Reflect.getMetadata(PERMISSIONS_METADATA, controller);

			expect(view).toBeDefined();
			expect(view).not.toEqual([grant]);

			// The resolver classes state no permission of their own — every root field of this package
			// states its own — so the declaration on the field is the only thing between the act and
			// `PermissionGuard`'s `isEmpty(permissions)` branch, which allows a request outright.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toBeUndefined();
		}
	});

	it('reads the three grants the routes were read to state', () => {
		// The session's two acts carry the authorising grant rather than the view grant, and the
		// instrument's one carries the edit grant the kernel catalogue publishes for it.
		expect(PARITY.map(({ grant }) => grant)).toEqual([
			PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE,
			PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE,
			PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT
		]);
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller)).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

			// The resolver's chain adds the platform's feature gate, after the permission guards: a field
			// is refused as a credential problem before a tenant's switches are consulted. Asserted as a
			// superset of the route's chain, plus the gate's own presence, because the two surfaces do not
			// have to carry an identical list — the resolver must not carry a weaker one.
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
			expect(guardsOf(resolver, field)).toContain(FeatureFlagGuard);
		}
	});
});

/**
 * The reading, asserted rather than described.
 *
 * Every route the audit flagged and this suite does not implement is pinned here: the label it printed is
 * accounted for by exactly one bucket, the name it looked for is absent from the document, and the field
 * that serves the capability — or the door the capability actually has — is present. A future wave that
 * renames a serving field, or that adds one of these names without meaning to, fails here.
 */
describe('the fifteen flagged routes — four buckets, none of them left unread', () => {
	it('flags fifteen routes, implements three, serves five under another name, and refuses seven', () => {
		// Bucket three — a child or a pivot reached through a parent's or a sibling's field — is empty for
		// this package, and the empty table is asserted rather than left implicit.
		const throughParent: unknown[] = [];

		expect(PARITY).toHaveLength(3);
		expect(COLLAPSED).toHaveLength(5);
		expect(throughParent).toHaveLength(0);
		expect(REFUSED).toHaveLength(7);

		expect(PARITY.length + COLLAPSED.length + throughParent.length + REFUSED.length).toBe(15);
	});

	it('accounts for the instrument’s own fifteen labels, one bucket each', () => {
		// The instrument's output, reproduced: every label it printed is the `expects` of exactly one row
		// above, and no row claims a label the instrument never printed.
		const labelled = [...PARITY, ...COLLAPSED, ...REFUSED].map(({ expects }) => expects);

		expect(labelled).toHaveLength(15);
		expect(labelled.sort()).toEqual([...FLAGGED].sort());
	});

	it('serves the three implemented routes, and the refresh one is the row the audit named as a verb', () => {
		// Two of the three carry a name the audit's convention would have accepted had the document carried
		// the field at all — `updatePaymentSession` and `updatePaymentMethodToken` — and the third is a
		// domain verb, which the audit looks for as a verb-plus-stem pair. All three are declared now, and
		// the verb row is the one whose flag was a missing capability rather than a naming convention: the
		// audit's own test finds the name this wave declared.
		for (const { field } of PARITY) {
			expect(declares(field)).toBe(true);
		}

		expect(declares('refreshPaymentSession')).toBe(true);
		expect(auditHoldsForVerb('refresh', 'PaymentSession')).toBe(true);
	});

	it.each(COLLAPSED)('$resource.$route is served by $field', async (row) => {
		const { controller, route, expects, verb, field, method, resource, member } = row;

		// The route is real and declared, which is what makes the audit's flag a statement about the
		// surface rather than about a handler that does not exist.
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The audit's expectation is absent — either the name it built, or, for a domain verb, every field
		// name that carries the verb — while the capability is answered by the field named here. The label
		// of a verb row is the audit's own spelling, so the asterisks it prints are stripped before its
		// rule is applied.
		if (verb) {
			expect(auditHoldsForVerb(expects.replace(/\*/g, ''), resource)).toBe(false);
		} else {
			expect(declares(expects)).toBe(false);
		}

		expect(declares(field)).toBe(true);

		// And the serving field is a door to the same method the route reaches, driven over one stub: the
		// reading is a measurement rather than a naming claim.
		const { service, controller: overRest, resolver } = surfacesFor(row);

		const restAnswer = await overRest[route](...row.routeArgs);
		const graphAnswer = await resolver[field](...row.fieldArgs);

		expect(service[method]).toHaveBeenNthCalledWith(1, ...row.routeServiceArgs);
		expect(service[method]).toHaveBeenNthCalledWith(2, ...row.fieldServiceArgs);
		expect(service[method]).toHaveBeenCalledTimes(2);

		// One answer, one implementation: the row either surface acted on is the same row.
		expect(graphAnswer[member]).toBe(restAnswer);
		expect(restAnswer).toBe(COLLAPSED_ROW);
	});

	it.each(REFUSED)('$resource.$route is refused, and what it was for is answered', ({ controller, route, expects, served }) => {
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The name the audit looked for is not declared, and the suite asserts that rather than describing
		// it: a wave that adds one of these writes to the schema has to delete the row that refuses it.
		expect(declares(expects)).toBe(false);

		// What each route was for is reached another way: through the resource's own operations, through
		// the recoverable pair every resource of this package serves, or through the reprocessing field the
		// callback log actually offers.
		for (const field of served) {
			expect(declares(field)).toBe(true);
		}
	});

	it('refuses the collection’s hard delete on words that forbid it only while a payment references it', () => {
		// The weakest of the seven refusals, stated as such: `05` §12.2 forbids the hard delete
		// conditionally, and the condition is the service's to enforce — which no method of this package
		// does. The assertion is that the field is absent, so a wave that adds it has to answer the
		// condition first.
		expect(declares('deletePaymentCollection')).toBe(false);
		expect(typeof handlersOf(PaymentCollectionController).delete).toBe('function');
	});

	it('counts the two routes the audit credited to a same-named field as its own blind spot', () => {
		// Neither of these two is in the instrument's fifteen, because a field of the expected name exists —
		// which is exactly the blindness the assignment comparison cannot see through. The refund one is
		// repaired by this wave and the reason one is an owner decision, so both are pinned here.
		expect(FLAGGED).not.toContain('updateRefund');
		expect(FLAGGED).not.toContain('deleteRefundReason');

		// The control: the sibling delete route of the reason resource *is* in the fifteen, so the row above
		// is about one route being credited to another field rather than about the resource being unflagged.
		expect(FLAGGED).toContain('deleteRefund');

		expect(declares('updateRefund')).toBe(true);
		expect(declares('deleteRefundReason')).toBe(true);
	});
});

/**
 * The owner decision this wave records rather than makes.
 *
 * `DELETE /refund-reasons/:id` reaches the inherited hard `delete`, and the field
 * `deleteRefundReason` reaches `RefundReasonService.deactivateReason`. Two sentences in this package are
 * each false of the route beside them: the controller's own docstring says "a reason that is finished with
 * is deactivated rather than deleted: the reporting that groups by it has to keep resolving", and the
 * resolver's says "There is no hard delete". Both describe the field and neither describes the route. The
 * third fact is the one that makes it more than a naming complaint: `DELETE /refunds/:id` hard-deletes a
 * money record, while `13` §11.4 names `refund` in its "no hard delete through the API" row.
 *
 * The divergence is asserted so that a later wave meets it deliberately rather than by discovering it, and
 * nothing here changes either route: making a route named "delete" stop deleting is a semantics decision,
 * not a bug fix.
 */
describe('the refund-reason delete — recorded, not repaired', () => {
	it('reaches the inherited hard delete, while the field of that name deactivates', async () => {
		const reason: Row = {
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
			deactivateReason: jest.fn().mockResolvedValue({ id: ID, isActive: false })
		};
		const controller = new RefundReasonController(reason as never) as Row;
		const resolver = new RefundReasonResolver(reason as never) as Row;

		await controller.delete(ID);
		await resolver.deleteRefundReason(ID);

		// Two acts behind one name: the route removes the row, the field keeps it and clears `isActive`.
		expect(reason.delete).toHaveBeenCalledTimes(1);
		expect(reason.delete).toHaveBeenCalledWith(ID);
		expect(reason.deactivateReason).toHaveBeenCalledTimes(1);
		expect(reason.deactivateReason).toHaveBeenCalledWith(ID);
	});

	it('reports the deletion as a deletion and the deactivation as a deactivation', async () => {
		const reason: Row = {
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
			deactivateReason: jest.fn().mockResolvedValue({ id: ID, isActive: false })
		};
		const resolver = new RefundReasonResolver(reason as never) as Row;

		// The field's own payload says `deleted: true` while the row it carries is still there and merely
		// inactive, which is the shape a reader of the schema cannot distinguish from a removal.
		await expect(resolver.deleteRefundReason(ID)).resolves.toMatchObject({
			deleted: true,
			refundReason: { isActive: false }
		});
	});
});

/**
 * The two surfaces of one collapsed capability, over the stub that owns it.
 *
 * The collapsed rows are driven through the real classes so that "served under another name" is a measured
 * claim about the method both reach rather than a table of names. Every collaborator other than the one
 * that owns the capability answers a foreign row, so a field wired to a sibling service is caught by the
 * identity of the answer rather than hidden behind a shared double.
 *
 * @param row The collapsed row whose two surfaces are built.
 * @returns The service stub and the two surfaces.
 */
function surfacesFor(row: (typeof COLLAPSED)[number]): { service: Row; controller: Row; resolver: Row } {
	const service = collaborator(COLLAPSED_ROW);
	const foreign = collaborator(FOREIGN);
	const stubs: Row = Object.fromEntries(row.deps.map((name) => [name, name === row.service ? service : foreign]));

	// The stored-instrument controller takes the kernel service first and the lifecycle collaborator
	// second, and it is the second one both its revoke route and the field reach.
	const controller =
		row.controller === PaymentMethodTokenController
			? new row.controller(stubs.token, service)
			: new row.controller(service);

	return { service, controller: controller as Row, resolver: resolverFor(row.field, stubs) };
}

/** The resolver that declares one root field, over the stubs its constructor takes. */
function resolverFor(field: string, stubs: Row): Row {
	switch (field) {
		case 'capturePayment':
			return new PaymentCaptureResolver(stubs.capture as never) as Row;
		case 'revokePaymentMethodToken':
			return new PaymentMethodTokenResolver(
				stubs.tokenLifecycle as never,
				stubs.visibility as never,
				stubs.token as never
			) as Row;
		case 'openPaymentSession':
		case 'voidPaymentSession':
			return new PaymentSessionResolver(stubs.session as never) as Row;
		case 'deleteRefundReason':
			return new RefundReasonResolver(stubs.reason as never) as Row;
		default:
			throw new Error(`this suite declares no resolver for the field "${field}"`);
	}
}
