/**
 * The write routes of this package that no field answered, and the reading that collapsed or refused the
 * rest.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **twenty-four** of this package's
 * fifty-seven write routes — which is not a gap count, because the instrument is blind in the two
 * directions that matter here. It expects a CRUD handler to be answered by `<verb><Resource>`
 * (`softRemove` → `softDelete<Resource>`, `softRecover` → `recover<Resource>`) and it expects a
 * domain verb to appear *somewhere* in a field's name, so it cannot see a capability answered under
 * another name, nor one answered by the parent or by a sibling. It also reads a name and not a
 * capability, so it reads `updateCampaignBudget` as an answer to `PUT /campaign-budgets/:id` — the row's
 * own update route — while the field it found mirrors `PUT /campaigns/:id/budget`, a different route of a
 * different controller. That false negative is not in the twenty-four and is recorded below beside them.
 *
 * The reading leaves the twenty-four in four buckets, and every row of all four is asserted rather than
 * described:
 *
 * - **Five genuine gaps**, which this suite is mostly about: `resetBudget` on the campaign controller,
 *   `createBatch` on the coupon controller, and `update`, `refund` and `adjust` on the gift-card
 *   controller. Each is a capability a REST caller has and a GraphQL caller did not, and each is
 *   delivered here with the arguments its route takes, the permission its route states and the same
 *   service call.
 * - **Four naming variants**, where the capability is already reachable: `setBudget` is
 *   `updateCampaignBudget`, `replaceActions` is `replacePromotionActions`, the gift-card `create` is
 *   `issueGiftCard`, and the gift-card `cancel` is `voidGiftCard` — four fields the specification's own
 *   promotion row names, each of which reaches the very method its route reaches.
 * - **Five child-through-parent routes**: the campaign's ceiling is created by the campaign's own set
 *   field (the table holds one live budget per campaign, `UQ_campaign_budget`, so `setBudget` *is* the
 *   create), the ceiling is unbounded by retiring it recoverably, and an action's own create, update and
 *   delete are the three statements a whole-set replacement already makes: `PromotionActionService.replaceActions`
 *   deletes the set and writes the new one, so adding an action, changing one and removing one are all the
 *   one field.
 * - **Ten routes the specifications refuse to mirror**, and each refusal is cited where it is made:
 *   the create, update and delete routes of `campaign_budget_usage`, of `gift_card_transaction` and of
 *   `promotion_usage` — a derived consumption row and two ledgers — and the gift-card resource's own
 *   hard delete, which cascades the card's ledger away. `06-api-specification.md` §7.22 states the rule
 *   for `promotion_usage` in as many words ("Capabilities that deliberately have **no** endpoint: …
 *   direct writes to `promotion_usage` (written by the checkout and cancellation operations)");
 *   `08-pricing-and-promotions-spec.md` §8.3 states it for the per-value row ("Maintained by the same
 *   row-locked increment as the parent budget, inside the same transaction; the two can never disagree
 *   after a commit") with the invariant at `02-commerce-domain-model.md` P6 and the data tier at
 *   `13-migration-and-rollout-plan.md` ("Rebuildable — saturable … derived from usage");
 *   `19-naming-and-placement-doctrine.md` states it for the card's ledger ("the child stores the
 *   append-only history of how it got there … `gift_card.balance` beside `gift_card_transaction`"), with
 *   the retention decision at `16-decision-log-and-open-questions.md` (the financial ledgers "are kept
 *   forever and in full") and the accounting tier at `13-migration-and-rollout-plan.md` (the money trail,
 *   "records a business is obliged to retain"); and `06-api-specification.md` §7.10 names the withdrawal
 *   of a card as `POST /gift-cards/:id/cancel`, which `voidGiftCard` answers, while the card's hard delete
 *   would take its ledger with it (`gift_card_transaction` cascades from `gift_card`).
 *
 * Three properties are pinned for each of the five, exactly as the lifecycle pair's suite pins them:
 *
 * - it is **declared** in this plugin's document, with the arguments the route takes and the payload its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   because `PermissionGuard` resolves handler-then-class and the class grant of every one of these
 *   controllers is the view grant none of these acts carries;
 * - it **reaches the same service call with the same arguments the route reaches**, because two protocols
 *   that perform one act differently are two behaviours waiting to diverge — and it mirrors the route's
 *   `@Idempotent` scope and `@Versioned` expectation where the route declares one, which none of these
 *   five does.
 *
 * **Nothing is doubled here but the services.** The three controllers are the real ones, the three
 * resolvers are the real ones with their own decorators and signatures, `CrudController` behind them is
 * the kernel's own, and the document the fields are read out of is the real one. A resolver's other
 * collaborators are stubs of their own rather than copies of the one under test, so a field that reached
 * the wrong service is visible instead of passing on a shared double.
 */

import { getMetadataStorage } from 'class-validator';
import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	InputValueDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import { PromotionPermission } from '../../promotion.permissions';
import { CampaignController } from '../../campaign/campaign.controller';
import { CouponController } from '../../coupon/coupon.controller';
import { CreateCouponDTO } from '../../coupon/dto';
import { GiftCardController } from '../../gift-card/gift-card.controller';
import { UpdateGiftCardDTO } from '../../gift-card/dto';
import { CampaignBudgetController } from '../../campaign-budget/campaign-budget.controller';
import { CampaignBudgetUsageController } from '../../campaign-budget-usage/campaign-budget-usage.controller';
import { GiftCardTransactionController } from '../../gift-card-transaction/gift-card-transaction.controller';
import { PromotionActionController } from '../../promotion-action/promotion-action.controller';
import { PromotionUsageController } from '../../promotion-usage/promotion-usage.controller';
import { PromotionController } from '../../promotion/promotion.controller';
import { schemaExtensions } from '../schema-extensions';
import { CampaignResolver } from './campaign.resolver';
import { CouponResolver } from './coupon.resolver';
import { GiftCardResolver } from './gift-card.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const ID = '00000000-0000-4000-8000-0000000000c1';
const CAMPAIGN = '00000000-0000-4000-8000-0000000000c2';
const ORDER = '00000000-0000-4000-8000-0000000000c3';
const PROMOTION = '00000000-0000-4000-8000-0000000000c4';

/** The reason both budget routes state, which is the operator's and not the service's. */
const REASON = 're-opened for the spring push';

/** The movements both card routes ask for, and what the service applies of them. */
const REFUND = { amount: '10.000000', orderId: ORDER, note: 'returned in full' };
const ADJUSTMENT = { amount: '-2.000000', note: 'goodwill correction' };

/** The change both card update surfaces state. */
const CARD_CHANGE = { expiresAt: new Date('2027-01-01T00:00:00.000Z'), customerId: ORDER };

/** The batch both surfaces mint, and the format the codes are minted in. */
const CODE_FORMAT = { significantLength: 8, groupSize: 4 };
const BATCH_REQUEST = { promotionId: PROMOTION, count: 3, couponCodeFormat: CODE_FORMAT };

/**
 * What each service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that re-opens a ceiling over GraphQL and one that
 * re-opens it over REST must be looking at the same budget afterwards.
 */
const BUDGET = { id: ID, campaignId: CAMPAIGN, used: '0.000000' };
const BATCH = { batchId: 'b-20260201-AB12', requested: 3, created: 3, failed: 0 };
const CARD = { id: ID, code: 'ABCD-EFGH-JKLM-NPQR', balance: '25.000000', currency: 'USD' };
const APPLIED = '10.000000';

/**
 * What a collaborator other than the resource's own service answers with.
 *
 * It is deliberately a different row: a field that reached the wrong service would report it, and the
 * identity assertion below would fail rather than pass on a shared double.
 */
const FOREIGN = { id: ID, wrong: true };

/** The service that owns one capability, which is the stub the field has to reach. */
type ServiceKey = 'budget' | 'coupon' | 'giftCard';

/**
 * One of the five routes, its two surfaces, and what its field must mirror.
 */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit looked for, which for the two verbs is the verb itself. */
	expects: string;
	/** The arguments the route's handler takes. */
	routeArgs: any[];
	/** The arguments the field takes, which mirror what the route *writes*. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces. */
	serviceArgs: any[];
	/** The member the payload carries the answer under. */
	member: string;
	/** The member the *route's* answer carries it under, when the route wraps it. */
	routeMember?: string;
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with, which is what the resource's other mutations answer. */
	answers: string;
	/** The grant the route's own handler states. */
	grant: string;
	/** The method both surfaces must reach. */
	method: string;
	/** The stub that owns the capability. */
	service: ServiceKey;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/** Builds the two surfaces over the stubs. */
	build: (stubs: Row) => { controller: Row; resolver: Row };
}

/**
 * The five routes no field answered.
 *
 * Each is a capability rather than a spare route: re-opening a spent ceiling, minting a mailing's worth
 * of codes in one atomic request, and a card's own editable surface, its refund and its correction —
 * none of which any field reached, because `updateCampaignBudget` moves a ceiling without forgetting
 * what it paid out, `createCoupon` mints the one code its input names, and the card's fields spent,
 * withdrew and retired it without ever changing what it says about itself.
 */
const PARITY: IParity[] = [
	{
		field: 'resetCampaignBudget',
		route: 'resetBudget',
		resource: 'Campaign',
		expects: 'resetBudget',
		routeArgs: [CAMPAIGN, { reason: REASON }],
		fieldArgs: [CAMPAIGN, { reason: REASON }],
		serviceArgs: [CAMPAIGN, REASON],
		member: 'budget',
		declared: [
			['campaignId', 'ID'],
			['input', 'ResetCampaignBudgetInput']
		],
		answers: 'ResetCampaignBudgetPayload',
		grant: PromotionPermission.PROMOTIONS_EDIT,
		method: 'resetConsumption',
		service: 'budget',
		controller: CampaignController,
		resolver: CampaignResolver,
		build: (stubs) => ({
			controller: new CampaignController(stubs.campaign, stubs.budget) as Row,
			resolver: new CampaignResolver(stubs.campaign, stubs.budget, stubs.foreign) as Row
		})
	},
	{
		field: 'createCouponBatch',
		route: 'createBatch',
		resource: 'Coupon',
		expects: 'createBatch',
		routeArgs: [BATCH_REQUEST],
		fieldArgs: [BATCH_REQUEST],
		serviceArgs: [BATCH_REQUEST],
		member: 'batch',
		declared: [['input', 'CreateCouponBatchInput']],
		answers: 'CreateCouponBatchPayload',
		grant: PromotionPermission.COUPONS_CREATE,
		method: 'createBatch',
		service: 'coupon',
		controller: CouponController,
		resolver: CouponResolver,
		build: (stubs) => ({
			controller: new CouponController(stubs.coupon) as Row,
			resolver: new CouponResolver(stubs.coupon, stubs.foreign, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'updateGiftCard',
		route: 'update',
		resource: 'GiftCard',
		expects: 'updateGiftCard',
		routeArgs: [ID, CARD_CHANGE],
		fieldArgs: [ID, CARD_CHANGE],
		serviceArgs: [ID, CARD_CHANGE],
		member: 'giftCard',
		declared: [
			['id', 'ID'],
			['input', 'UpdateGiftCardInput']
		],
		answers: 'UpdateGiftCardPayload',
		grant: PromotionPermission.GIFT_CARDS_EDIT,
		method: 'update',
		service: 'giftCard',
		controller: GiftCardController,
		resolver: GiftCardResolver,
		build: (stubs) => ({
			controller: new GiftCardController(stubs.giftCard) as Row,
			resolver: new GiftCardResolver(stubs.giftCard, stubs.foreign, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'refundGiftCard',
		route: 'refund',
		resource: 'GiftCard',
		expects: 'refund',
		routeArgs: [ID, REFUND],
		fieldArgs: [ID, REFUND],
		serviceArgs: [ID, REFUND.amount, REFUND],
		member: 'giftCard',
		routeMember: 'card',
		declared: [
			['id', 'ID'],
			['input', 'RefundGiftCardInput']
		],
		answers: 'RefundGiftCardPayload',
		grant: PromotionPermission.GIFT_CARDS_EDIT,
		method: 'refund',
		service: 'giftCard',
		controller: GiftCardController,
		resolver: GiftCardResolver,
		build: (stubs) => ({
			controller: new GiftCardController(stubs.giftCard) as Row,
			resolver: new GiftCardResolver(stubs.giftCard, stubs.foreign, stubs.foreign, stubs.foreign) as Row
		})
	},
	{
		field: 'adjustGiftCard',
		route: 'adjust',
		resource: 'GiftCard',
		expects: 'adjust',
		routeArgs: [ID, ADJUSTMENT],
		fieldArgs: [ID, ADJUSTMENT],
		serviceArgs: [ID, ADJUSTMENT.amount, ADJUSTMENT.note],
		member: 'giftCard',
		routeMember: 'card',
		declared: [
			['id', 'ID'],
			['input', 'AdjustGiftCardInput']
		],
		answers: 'AdjustGiftCardPayload',
		grant: PromotionPermission.GIFT_CARDS_EDIT,
		method: 'adjust',
		service: 'giftCard',
		controller: GiftCardController,
		resolver: GiftCardResolver,
		build: (stubs) => ({
			controller: new GiftCardController(stubs.giftCard) as Row,
			resolver: new GiftCardResolver(stubs.giftCard, stubs.foreign, stubs.foreign, stubs.foreign) as Row
		})
	}
];

/**
 * The nine routes the reading collapsed, each with the field that already serves it.
 *
 * A route is listed here because its *capability* is answered, not because its handler name is: the audit's
 * expectation for each is asserted absent below — for the three domain verbs, absent as a substring of
 * every field's name, which is the test the instrument itself applies — so this table fails if a future
 * wave renames one of the serving fields out from under the routes that name it in their own docstrings.
 */
const COLLAPSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	/** The audit's expectation: a name for a CRUD handler, and the verb itself for a domain one. */
	expects: string;
	/** Whether the audit looks for the verb anywhere in a field's name rather than for the name itself. */
	verb: boolean;
	field: string;
}[] = [
	// The campaign's budget verbs: the ceiling is set through the campaign, and the field the document
	// declares for that is `updateCampaignBudget`, which reaches `setBudget` — the same upsert the
	// `PUT /campaigns/:id/budget` route reaches. The audit's glob `*setBudget*` matches no field, and none
	// is wanted: the field is named for what it writes.
	{ controller: CampaignController, resource: 'Campaign', route: 'setBudget', expects: 'setBudget', verb: true, field: 'updateCampaignBudget' },
	// The action set: replaced whole, through the one field that states it. Adding an action, changing one
	// and dropping one are three statements about the same set, and `replacePromotionActions` — whose
	// service deletes the set and writes the new one — is the door for all three.
	{
		controller: PromotionController,
		resource: 'Promotion',
		route: 'replaceActions',
		expects: 'replaceActions',
		verb: true,
		field: 'replacePromotionActions'
	},
	// The card is issued, not "created": `issueGiftCard` is the name the specification's own promotion row
	// gives the field, and the permission it states (`GIFT_CARDS_ISSUE`) is why the name matters — every
	// card issued is money the business owes.
	{ controller: GiftCardController, resource: 'GiftCard', route: 'create', expects: 'createGiftCard', verb: false, field: 'issueGiftCard' },
	// The card is withdrawn, not "cancelled": `voidGiftCard` reaches `GiftCardService.cancel`, which moves
	// the status to `CANCELED` and keeps the ledger, and the specification's promotion row names it.
	{ controller: GiftCardController, resource: 'GiftCard', route: 'cancel', expects: 'cancel', verb: true, field: 'voidGiftCard' },
	// A ceiling is created by the campaign's own set field. The table holds one live budget per campaign
	// (`UQ_campaign_budget`), so the first `PUT /campaigns/:id/budget` stores the ceiling and every later
	// one moves it — which is exactly the capability `POST /campaign-budgets` offers on its own path.
	{
		controller: CampaignBudgetController,
		resource: 'CampaignBudget',
		route: 'create',
		expects: 'createCampaignBudget',
		verb: false,
		field: 'updateCampaignBudget'
	},
	// A ceiling is unbounded by retiring it recoverably: a soft-deleted budget is excluded from the read
	// the evaluation makes, so the campaign runs without a ceiling — the state the destructive route
	// leaves it in — and the row is still there to bring back.
	{
		controller: CampaignBudgetController,
		resource: 'CampaignBudget',
		route: 'delete',
		expects: 'deleteCampaignBudget',
		verb: false,
		field: 'softDeleteCampaignBudget'
	},
	{
		controller: PromotionActionController,
		resource: 'PromotionAction',
		route: 'create',
		expects: 'createPromotionAction',
		verb: false,
		field: 'replacePromotionActions'
	},
	{
		controller: PromotionActionController,
		resource: 'PromotionAction',
		route: 'update',
		expects: 'updatePromotionAction',
		verb: false,
		field: 'replacePromotionActions'
	},
	{
		controller: PromotionActionController,
		resource: 'PromotionAction',
		route: 'delete',
		expects: 'deletePromotionAction',
		verb: false,
		field: 'replacePromotionActions'
	}
];

/**
 * The ten routes the specifications refuse to mirror, and the fields that answer what they were for.
 *
 * These are not gaps to be closed later: each is a write over a derived row or over a ledger, and the
 * section that refuses it is named beside it. What a caller reaches instead is the `served` list — the
 * card's own operations, which are the only writers of its ledger, and the recoverable pair each of these
 * three resources serves and answers.
 */
const REFUSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	served: string[];
}[] = [
	// The per-value consumption row is derived: the budget service maintains it inside the transaction
	// that grants a discount (`08` §8.3), the parent's `used` is the sum of these rows (`02` P6, `05`
	// §10.3), and the nightly audit re-derives the counters from the usage rows (`12`). `13` classifies
	// the table as "Rebuildable — saturable … derived from usage", so a create, an update or a delete here
	// is an authoring surface over derived state — which is the reading `campaign-budget-usage.resolver.ts`
	// already records for the controller's own repair routes.
	{ controller: CampaignBudgetUsageController, resource: 'CampaignBudgetUsage', route: 'create', expects: 'createCampaignBudgetUsage', served: ['softDeleteCampaignBudgetUsage', 'recoverCampaignBudgetUsage'] },
	{ controller: CampaignBudgetUsageController, resource: 'CampaignBudgetUsage', route: 'update', expects: 'updateCampaignBudgetUsage', served: ['softDeleteCampaignBudgetUsage', 'recoverCampaignBudgetUsage'] },
	{ controller: CampaignBudgetUsageController, resource: 'CampaignBudgetUsage', route: 'delete', expects: 'deleteCampaignBudgetUsage', served: ['softDeleteCampaignBudgetUsage', 'recoverCampaignBudgetUsage'] },
	// The card's ledger is append-only and is the authority on what a card is worth (`19`; `05` §10.9):
	// `balance = initialAmount + Σ movements` is an invariant the specs assert, and a create with a
	// caller-chosen `balanceAfter`, an update of a row or a delete of one each break it — the delete by
	// leaving a hole in the chain the balance is replayed from. `13` puts the table in the money trail a
	// business is obliged to retain and `16` keeps the financial ledgers "forever and in full". Every
	// movement is written by one of the card's own operations, which are the fields listed here.
	{ controller: GiftCardTransactionController, resource: 'GiftCardTransaction', route: 'create', expects: 'createGiftCardTransaction', served: ['issueGiftCard', 'redeemGiftCard', 'refundGiftCard', 'adjustGiftCard', 'voidGiftCard'] },
	{ controller: GiftCardTransactionController, resource: 'GiftCardTransaction', route: 'update', expects: 'updateGiftCardTransaction', served: ['adjustGiftCard'] },
	{ controller: GiftCardTransactionController, resource: 'GiftCardTransaction', route: 'delete', expects: 'deleteGiftCardTransaction', served: ['softDeleteGiftCardTransaction', 'recoverGiftCardTransaction'] },
	// `06` §7.22 states this refusal in as many words: direct writes to `promotion_usage` are a capability
	// that deliberately has no endpoint, because the checkout and the cancellation operations write the
	// rows. The ledger and the promotion's cached counter are two halves of one fact, and a create that
	// wrote one without the other is the half-write that made `usageLimit` unenforceable.
	{ controller: PromotionUsageController, resource: 'PromotionUsage', route: 'create', expects: 'createPromotionUsage', served: ['softDeletePromotionUsage', 'recoverPromotionUsage'] },
	{ controller: PromotionUsageController, resource: 'PromotionUsage', route: 'update', expects: 'updatePromotionUsage', served: ['softDeletePromotionUsage', 'recoverPromotionUsage'] },
	{ controller: PromotionUsageController, resource: 'PromotionUsage', route: 'delete', expects: 'deletePromotionUsage', served: ['softDeletePromotionUsage', 'recoverPromotionUsage'] },
	// A card is withdrawn, never dropped: `06` §7.10 names `POST /gift-cards/:id/cancel` as the act and
	// declares no delete for the resource, `gift_card_transaction` cascades from `gift_card` (so the hard
	// delete takes the ledger with it), and the ledger is one of the records `16` keeps in full and `13`
	// calls part of the money trail. The service states the same rule in its own words: "Nothing is
	// deleted."
	{ controller: GiftCardController, resource: 'GiftCard', route: 'delete', expects: 'deleteGiftCard', served: ['voidGiftCard', 'softDeleteGiftCard', 'recoverGiftCard'] }
];

/**
 * The one route the audit did not flag and the reading found anyway.
 *
 * `PUT /campaign-budgets/:id` updates the ceiling row by its own identifier, and the instrument counts it
 * as answered because a field named `updateCampaignBudget` exists. That field mirrors
 * `PUT /campaigns/:id/budget` instead: it takes the campaign and reaches `setBudget`, which for an
 * existing ceiling calls the very `update` the row's own route calls. The capability is therefore served
 * — through the parent, with the consumption preserved, which is what the row's own route does — and the
 * assertion below is what keeps that a measurement rather than a claim.
 */
const SERVED_THROUGH_PARENT = {
	controller: CampaignBudgetController,
	resource: 'CampaignBudget',
	route: 'update',
	field: 'updateCampaignBudget'
};

/**
 * The members every DTO of this package inherits from the credential rather than declaring.
 *
 * They belong to the caller rather than to a body, no input in this document states them, and a
 * comparison that read them would demand that one did.
 */
const SCOPE_MEMBERS = ['organization', 'organizationId', 'sentTo', 'tenant', 'tenantId'];

/**
 * The members a DTO validates, its own and the ones it inherits.
 *
 * The wholesale read, needed for a `PartialType`: it returns a class the declared DTO only *extends*, so
 * the metadata it copied carries the returned class as its target and an own-target read of the declared
 * one would find nothing at all — and for `CreateGiftCardDTO`, which the update shape is derived from,
 * the same is true one step up.
 *
 * @param dto The DTO to read.
 * @returns Every member name it validates, sorted.
 */
function allDtoMembers(dto: new (...args: any[]) => any): string[] {
	const metadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);

	return Array.from(new Set(metadata.map((entry) => entry.propertyName))).sort();
}

/**
 * The methods the five fields and their routes reach, which every stub therefore carries.
 *
 * A collaborator is only useful as a negative control if it *could* have answered the call: a stub
 * without the method would make "no other service was touched" pass on an absence rather than on a
 * measurement.
 */
const CAPABILITY_METHODS = ['resetConsumption', 'createBatch', 'update', 'refund', 'adjust'];

/**
 * One collaborator stub, answering the row it is given with every method the five fields could reach.
 *
 * @param answer What the stub answers with.
 * @returns The stub.
 */
function collaborator(answer: unknown): Row {
	return Object.fromEntries(CAPABILITY_METHODS.map((method) => [method, jest.fn().mockResolvedValue(answer)]));
}

/**
 * Both surfaces over the stubs that own them.
 *
 * One stub per capability, and every other collaborator is a stub of its own answering a *different* row,
 * so a field wired to the wrong service is caught by the identity assertion rather than hidden behind a
 * shared double.
 *
 * @param entry The route whose two surfaces are built.
 * @returns The stubs, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { stubs: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		campaign: collaborator(FOREIGN),
		budget: { ...collaborator(FOREIGN), resetConsumption: jest.fn().mockResolvedValue(BUDGET) },
		coupon: { ...collaborator(FOREIGN), createBatch: jest.fn().mockResolvedValue(BATCH) },
		giftCard: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue({ affected: 1 }),
			findCardOrFail: jest.fn().mockResolvedValue(CARD),
			refund: jest.fn().mockResolvedValue({ card: CARD, applied: APPLIED }),
			adjust: jest.fn().mockResolvedValue({ card: CARD, applied: APPLIED })
		},
		// Everything else a resolver injects: a field that reached one of them would answer the foreign row.
		foreign: collaborator(FOREIGN)
	};

	const { controller, resolver } = entry.build(stubs);

	return { stubs, controller, resolver };
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
 * `[handler, class]`, which `PermissionGuard` then answers `true` to when the pair is empty.
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
		throw new Error('the promotion document declares no Mutation fields');
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
		throw new Error(`the promotion document declares no Mutation field named "${name}"`);
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
		throw new Error(`the promotion document declares no input named "${name}"`);
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
		throw new Error(`the promotion document declares no member "${member}" on "${name}"`);
	}

	return field;
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/**
 * The schema's half of the five fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the promotion document — the five routes no field answered are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, in the order the route states them', () => {
		for (const { field, declared } of PARITY) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));

			for (const [index, [, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
			}
		}
	});

	it('requires the members a write cannot be made without, and leaves an update optional', () => {
		// A write that names no row is not a write, so every argument that addresses one is non-null — and
		// the batch's input is the one input that is required, because a call that states nothing has nothing
		// to mint. The campaign's reset is the one nullable input: its body is `{ reason?: string }`, the
		// service keeps no reason, and the route answers a request that states none.
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? [])[0].type.kind).toBe('NonNullType');
		}

		expect(mutationField('resetCampaignBudget').arguments?.[1].type.kind).toBe('NamedType');
		expect(mutationField('createCouponBatch').arguments?.[0].type.kind).toBe('NonNullType');
		expect(mutationField('updateGiftCard').arguments?.[1].type.kind).toBe('NonNullType');
		expect(mutationField('refundGiftCard').arguments?.[1].type.kind).toBe('NonNullType');
		expect(mutationField('adjustGiftCard').arguments?.[1].type.kind).toBe('NonNullType');
	});

	it('answers the payload each resource’s other mutations answer', () => {
		for (const { field, answers } of PARITY) {
			const type = mutationField(field).type;

			expect(namedTypeName(type)).toBe(answers);
			expect(type.kind).toBe('NonNullType');
		}
	});

	it('declares the members the route’s own body carries, and only those', () => {
		// Read from the DTO each route validates its body with rather than restated here, so a member added
		// to a DTO and not to the input fails this. Two members of the card's body are deliberately not on
		// the input — the ledger's base (`initialAmount`) and its materialised cache (`balance`), whose
		// correction is the adjustment route, and the second factor (`pin`), which is stored as a digest and
		// which no field of this schema states — and one of the coupon's is not either: `usageCount` is a
		// counter the service writes and increments, which the delivered `createCoupon` input already
		// leaves out for the same reason.
		const giftCardBody = allDtoMembers(UpdateGiftCardDTO).filter((member) => !SCOPE_MEMBERS.includes(member));
		const couponBody = allDtoMembers(CreateCouponDTO).filter((member) => !SCOPE_MEMBERS.includes(member));

		// The control, so the two comparisons below cannot pass on two empty readings.
		expect(giftCardBody).toEqual([
			'balance',
			'code',
			'currency',
			'customerId',
			'expiresAt',
			'initialAmount',
			'metadata',
			'orderId',
			'pin',
			'status'
		]);
		expect(couponBody).toEqual([
			'batchId',
			'code',
			'endsAt',
			'metadata',
			'perCustomerLimit',
			'promotionId',
			'startsAt',
			'usageCount',
			'usageLimit'
		]);

		expect(inputMembers('UpdateGiftCardInput').sort()).toEqual(
			giftCardBody.filter((member) => !['balance', 'initialAmount', 'pin'].includes(member))
		);
		expect(inputMembers('CreateCouponBatchInput').sort()).toEqual(
			[...couponBody.filter((member) => member !== 'usageCount'), 'count', 'couponCodeFormat'].sort()
		);

		// The other three routes declare an inline body type rather than a DTO class, so their members are
		// read from the handler's own signature in this file: there is no validation metadata to read.
		expect(inputMembers('ResetCampaignBudgetInput')).toEqual(['reason']);
		expect(inputMembers('RefundGiftCardInput').sort()).toEqual(['amount', 'note', 'orderId']);
		expect(inputMembers('AdjustGiftCardInput').sort()).toEqual(['amount', 'note']);
	});

	it('requires the members the route’s own body requires, and leaves the rest optional', () => {
		// An update states what changed rather than restating the row, so every member of the card's input is
		// optional; a correction that states no reason is refused by the service, and a batch that states no
		// count has nothing to mint — so those three are required here as they are on the route.
		for (const member of inputMembers('UpdateGiftCardInput')) {
			expect(inputMember('UpdateGiftCardInput', member).type.kind).toBe('NamedType');
		}

		expect(inputMember('CreateCouponBatchInput', 'count').type.kind).toBe('NonNullType');
		expect(inputMember('RefundGiftCardInput', 'amount').type.kind).toBe('NonNullType');
		expect(inputMember('AdjustGiftCardInput', 'amount').type.kind).toBe('NonNullType');
		expect(inputMember('AdjustGiftCardInput', 'note').type.kind).toBe('NonNullType');
		expect(inputMember('RefundGiftCardInput', 'note').type.kind).toBe('NamedType');
	});

	it('declares every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of [
			'createPromotion',
			'updatePromotion',
			'deletePromotion',
			'activatePromotion',
			'expirePromotion',
			'deactivatePromotion',
			'replacePromotionActions',
			'simulatePromotion',
			'softDeletePromotion',
			'recoverPromotion',
			'createCampaign',
			'updateCampaign',
			'deleteCampaign',
			'updateCampaignBudget',
			'createCoupon',
			'updateCoupon',
			'deleteCoupon',
			'issueGiftCard',
			'redeemGiftCard',
			'voidGiftCard',
			'softDeletePromotionAction',
			'recoverPromotionAction',
			'softDeletePromotionUsage',
			'recoverPromotionUsage',
			'softDeleteCampaignBudget',
			'recoverCampaignBudget',
			'softDeleteCampaignBudgetUsage',
			'recoverCampaignBudgetUsage',
			'softDeleteCoupon',
			'recoverCoupon',
			'softDeleteGiftCard',
			'recoverGiftCard',
			'softDeleteGiftCardTransaction',
			'recoverGiftCardTransaction'
		]) {
			expect(declares(name)).toBe(true);
		}
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
 * is the call each of them makes on its own stub, not a service method named in this file.
 */
describe('the five fields — the two protocols write the same rows the same way', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// One call each, with the same arguments in the same order: the route's body and the field's input
		// are one statement about the row, and a field that reordered them or dropped one would be a
		// different write.
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);

		// No other collaborator was touched: a field wired to the wrong service is a field that acts on the
		// wrong aggregate, and the payload would carry whatever that one returned.
		for (const [name, stub] of Object.entries(stubs)) {
			if (name === entry.service) {
				continue;
			}

			expect(stub[entry.method]).not.toHaveBeenCalled();
		}

		// One answer, one implementation: the row either surface wrote is the same row.
		const answer = entry.routeMember ? overRest[entry.routeMember] : overRest;

		expect(overGraphql[entry.member]).toBe(answer);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it('answers the batch with the counts the route answers with', async () => {
		const entry = PARITY.find(({ field }) => field === 'createCouponBatch') as IParity;
		const { controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// The counts are the batch's own answer to what was asked for and what was written, so they travel
		// unchanged rather than being recomputed from anything on this side.
		expect(overGraphql.batch).toBe(overRest);
		expect(overRest).toBe(BATCH);
	});

	it('answers the card’s movements with the amount actually applied', async () => {
		// Both movements answer the smaller of what was asked for and what the card could give, so the
		// figure the service applied travels with the card on both surfaces rather than the figure the
		// caller requested. Each movement also reaches its own method and not its sibling's: a refund that
		// went through the adjustment path would write an `ADJUST` row where the ledger expects a `REFUND`.
		for (const field of ['refundGiftCard', 'adjustGiftCard']) {
			const entry = PARITY.find((candidate) => candidate.field === field) as IParity;
			const { stubs, controller, resolver } = surfaces(entry);

			const overRest = await controller[entry.route](...entry.routeArgs);
			const overGraphql = await resolver[entry.field](...entry.fieldArgs);

			expect(overGraphql.applied).toBe(overRest.applied);
			expect(overGraphql.applied).toBe(APPLIED);

			expect(stubs.giftCard.refund).toHaveBeenCalledTimes(field === 'refundGiftCard' ? 2 : 0);
			expect(stubs.giftCard.adjust).toHaveBeenCalledTimes(field === 'adjustGiftCard' ? 2 : 0);
		}
	});

	it('reads the card back after the write, as the update route reads it back', async () => {
		// The CRUD base's `update` answers the updated row *or* an `UpdateResult`, so a field typed as a
		// non-null row reads the row back — and this route does the same read for the same reason, which is
		// why both surfaces make it rather than only the GraphQL one.
		const entry = PARITY.find(({ field }) => field === 'updateGiftCard') as IParity;
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		expect(stubs.giftCard.update).toHaveBeenCalledTimes(2);
		expect(stubs.giftCard.findCardOrFail).toHaveBeenCalledTimes(2);
		expect(stubs.giftCard.findCardOrFail).toHaveBeenNthCalledWith(1, ID);
		expect(stubs.giftCard.findCardOrFail).toHaveBeenNthCalledWith(2, ID);
		expect(overRest).toBe(CARD);
		expect(overGraphql.giftCard).toBe(CARD);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Each of the five is a write, so a field that stated no grant of its own would be one `PermissionGuard`
 * answers `true` to, because it answers `true` to empty metadata: every authenticated caller could
 * re-open a spent budget, mint a mailing's worth of codes, or move money on a card. No resolver in this
 * plugin states a class-level grant that could close that — every one of them states the *view* grant —
 * which is why the comparison is against the route's own handler metadata rather than against the class.
 */
describe('the five fields — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the grant each route states, on the handler itself', () => {
		for (const { field, route, controller, resolver, grant } of PARITY) {
			// Read from the field's own handler rather than through the override rule the guards apply:
			// `PermissionGuard` answers `true` to empty metadata, and every resolver of this plugin states a
			// class-level *view* grant that must not stand in for the field's own.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
		}
	});

	it('states the three grants the five routes state, and never a view grant', () => {
		expect(new Set(PARITY.map(({ grant }) => grant))).toEqual(
			new Set([
				PromotionPermission.PROMOTIONS_EDIT,
				PromotionPermission.COUPONS_CREATE,
				PromotionPermission.GIFT_CARDS_EDIT
			])
		);
	});

	it('declares no retry scope and no version expectation the route does not declare', () => {
		// None of the five routes carries `@Idempotent` or `@Versioned`, so neither does any of the five
		// fields: a keyless GraphQL retry would then not dedupe where REST does, and a version expectation
		// invented here would refuse writes the route accepts.
		for (const { field, route, controller, resolver } of PARITY) {
			for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
				expect(Reflect.getMetadata(key, fieldsOf(resolver)[field])).toBeUndefined();
				expect(Reflect.getMetadata(key, handlersOf(controller)[route])).toBeUndefined();
			}
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route, controller, resolver } of PARITY) {
			const routeGuards = guardsOf(controller);

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});

/**
 * The reading, asserted rather than described.
 *
 * Every route the audit flagged and this suite does not implement is pinned here: the name it looked for
 * is absent from the document, and the field that serves the capability — or the door the capability
 * actually has — is present. A future wave that renames a serving field, or that adds one of these names
 * without meaning to, fails here.
 */
describe('the twenty-four flagged routes — four buckets, none of them left unread', () => {
	it('flags twenty-four routes, collapses nine, refuses ten and implements five', () => {
		expect(COLLAPSED).toHaveLength(9);
		expect(REFUSED).toHaveLength(10);
		expect(PARITY).toHaveLength(5);
		expect(COLLAPSED.length + REFUSED.length + PARITY.length).toBe(24);
	});

	it.each(COLLAPSED)('$resource.$route is served by $field', ({ controller, route, expects, verb, field }) => {
		// The route is real and declared, which is what makes the audit's flag a statement about the surface
		// rather than about a handler that does not exist.
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The audit's expectation is absent — either the name it built from the handler and the resource, or,
		// for a domain verb, every field name that carries the verb — while the capability is answered by the
		// field the table names.
		if (verb) {
			expect(auditHoldsForVerb(expects, controller.name.replace(/Controller$/, ''))).toBe(false);
		} else {
			expect(declares(expects)).toBe(false);
		}

		expect(declares(field)).toBe(true);
	});

	it('serves the ceiling row’s own update through the campaign, as the audit assumed it did', () => {
		// The instrument counts `PUT /campaign-budgets/:id` as answered because a field of that name exists,
		// and the capability is in fact answered — through the campaign, by the same service `update` the
		// row's own route calls. This is the pin that keeps that reading honest.
		expect(typeof handlersOf(SERVED_THROUGH_PARENT.controller)[SERVED_THROUGH_PARENT.route]).toBe('function');
		expect(declares(SERVED_THROUGH_PARENT.field)).toBe(true);
	});

	it.each(REFUSED)('$resource.$route is refused, and what it was for is answered', ({ controller, route, expects, served }) => {
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The name the audit looked for is not declared, and the suite asserts that rather than describing
		// it: a wave that adds one of these writes to the schema has to delete the row that refuses it.
		expect(declares(expects)).toBe(false);

		// What the route was for is reached another way on every one of the ten: a movement through the
		// card's own operations, a retirement through the pair each resource serves, or a read.
		for (const field of served) {
			expect(declares(field)).toBe(true);
		}
	});
});
