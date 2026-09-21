#!/usr/bin/env node
/**
 * Gate: the GraphQL list surface follows the connection contract the doctrine states.
 *
 * The doctrine's §3.1 parity table requires that a list root field be the REST list route's counterpart:
 * *"Read many — a connection query supporting the same filters, the same sort keys, the same relation
 * loading and the same soft-delete visibility as the REST list route"*, and *"Count — `totalCount` on the
 * connection"*. Three rules follow, and none of them held across the whole surface when this gate was
 * written:
 *
 *   1. **A list root field returns a connection**, not a bare array. A bare array cannot be paged,
 *      filtered or counted, so the client that has the REST list has no counterpart to move to — which is
 *      the whole point of the parity requirement.
 *   2. **A connection carries `nodes`, `edges`, `totalCount` and a non-null `pageInfo`.** The older shape
 *      spelled the count `total` and left `pageInfo` nullable; a client that branches on `totalCount`
 *      reads nothing from those, and one that pages through a nullable `pageInfo` has to defend against a
 *      boundary it can never actually meet.
 *   3. **A count root field is nullable.** REST answers a bare number and a count that cannot be null
 *      cannot express "not counted" — which is what the doctrine says a `count` query is for.
 *
 * Both halves of the surface are read from the composed SDL, which is what the endpoint serves.
 *
 * **The two lists below are the baseline, and they are the point of this gate rather than an exception to
 * it.** 48 list root fields answer a bare array and 52 connection types still spell their count `total`;
 * each needs a connection type, its edge type and resolver arguments of its own, which is a wave of its
 * own rather than a line in someone else's. Naming every one of them is what makes the remainder
 * countable and keeps a *new* one from appearing unnoticed — and each conversion is a line removed from
 * these lists. A name that no longer violates its rule is reported as stale, so the wave that lands it has
 * to take it out rather than leaving the list describing a state that has moved on.
 *
 * Run from the repository root: `node tools/scripts/connection-shape-check.mjs`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SDL = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'schema', 'schema.graphql');

/** The SDL, with descriptions removed: a description's lines are indented like a field's. */
const schema = readFileSync(SDL, 'utf8')
	.replace(/"""(?:[\s\S]*?)"""/g, '')
	.replace(/^[ \t]*"(?:[^"\\]|\\.)*"[ \t]*$/gm, '')
	.replace(/^[ \t]*#.*$/gm, '');

const BARE_ARRAYS = new Set([
	'addressRoles', 'splitExpensesByEmployee', 'mySplitExpenses', 'featureToggleDefinitions',
	'myIncomes', 'unitCategories', 'units', 'operationsByAggregate',
	'organizationContactsByEmployee', 'organizationProjectsByEmployee', 'organizationStrategicInitiativesByProject', 'paymentTerms',
	'myRolePermissions', 'resolvePrice', 'taxRateParts', 'resolveTaxRate',
	'taxRegimeRates', 'stockLevels', 'stockMovements', 'stockReservations',
	'stockTransfers', 'stockTransferLines', 'stockAlerts', 'stockAdjustments',
	'stockCounts', 'stockCountLines', 'channelWarehouses', 'warehouseBinSubtree',
	'warehouseBinContents', 'warehouseBinCapacityWarnings', 'pickListLines', 'orderHistory',
	'orderLineInvoices', 'shippingOptionsForContext', 'orderReturnLines', 'orderClaimLines',
	'orderExchangeLines', 'sellers', 'sellerOfferings', 'sellerTransactions',
	'sellerSplitReconciliation', 'sellerPayouts', 'sellerPayoutLines', 'sellerSettlements',
	'searchSuggest', 'searchFacets', 'searchIndexDefinitions', 'searchIndexStatus',
]);

const LEGACY_CONNECTIONS = new Set([
	'CollectionVariantConnection', 'CollectionChannelConnection', 'TagProductVariantConnection', 'CollectionConnection',
	'CollectionProductConnection', 'ProductPublicationConnection', 'ProductVariantPublicationConnection', 'ProductRelationConnection',
	'ProductVariantMediaConnection', 'PriceListConnection', 'ProductPriceConnection', 'PricePreferenceConnection',
	'ExchangeRateConnection', 'WarehouseZoneConnection', 'WarehouseBinConnection', 'PickWaveConnection',
	'PickListConnection', 'PackSlipConnection', 'CarrierManifestConnection', 'CartConnection',
	'CheckoutSessionConnection', 'OrderConnection', 'OrderChangeConnection', 'OrderSummaryConnection',
	'OrderTransactionConnection', 'PaymentProviderConnection', 'PaymentCollectionConnection', 'PaymentSessionConnection',
	'PaymentCaptureConnection', 'RefundConnection', 'RefundReasonConnection', 'RefundLineConnection',
	'PaymentWebhookEventConnection', 'PaymentAccountHolderConnection', 'PaymentMethodTokenConnection', 'ShippingProfileConnection',
	'ShippingOptionConnection', 'FulfillmentConnection', 'OrderReturnConnection', 'OrderReturnReasonConnection',
	'OrderClaimConnection', 'OrderExchangeConnection', 'SubscriptionPlanConnection', 'CustomerSubscriptionConnection',
	'SubscriptionItemConnection', 'SubscriptionBillingConnection', 'PurchaseOrderConnection', 'GoodsReceiptConnection',
	'VendorProductTermConnection', 'EntitlementConnection', 'EntitlementActivationConnection', 'EntitlementKeyConnection',
]);

/** The body of `type <name> { … }`, or null when the schema declares no such type. */
function typeBody(name) {
	const start = schema.search(new RegExp(`^type\\s+${name}\\b[^{]*\\{`, 'm'));
	if (start === -1) return null;

	const open = schema.indexOf('{', start);
	let depth = 0;

	for (let index = open; index < schema.length; index++) {
		if (schema[index] === '{') depth++;
		else if (schema[index] === '}') {
			depth--;
			if (depth === 0) return schema.slice(open + 1, index);
		}
	}

	return null;
}

/** The fields a type declares at depth 0, with their type text. */
function fieldsOf(body) {
	const found = [];
	let braces = 0;
	let parens = 0;

	for (const line of body.split('\n')) {
		if (braces === 0 && parens === 0) {
			const field = /^\s*([A-Za-z_]\w*)\s*(\([\s\S]*?\))?\s*:\s*(.+?)\s*$/.exec(line);

			if (field) found.push({ name: field[1], type: field[3] });
		}

		for (const character of line) {
			if (character === '{') braces++;
			else if (character === '}') braces--;
			else if (character === '(') parens++;
			else if (character === ')') parens--;
		}
	}

	return found;
}

const failures = [];
const stale = [];
const queryFields = fieldsOf(typeBody('Query') ?? '');

// 1. A list root field is a connection.
for (const field of queryFields) {
	if (!/^\[/.test(field.type)) continue;

	if (!BARE_ARRAYS.has(field.name)) {
		failures.push(
			`Query.${field.name} -> returns \`${field.type}\`, a bare array; a list root field returns a connection`
		);
	}
}

// 3. A count root field is nullable.
//
// The name is what decides, and it ends with `Count` rather than starting with one: `countries` is a
// connection over countries, and a rule that read the prefix would have called it a count.
for (const field of queryFields) {
	const isCount = field.name === 'count' || /Count$/.test(field.name);

	if (!isCount || !field.type.endsWith('!')) continue;

	failures.push(`Query.${field.name} -> returns \`${field.type}\`; a count is nullable, because REST's bare number is`);
}

// 2. A connection is the canonical shape.
const connections = [...schema.matchAll(/^type\s+([A-Za-z_]\w*Connection)\b[^{]*\{/gm)].map((block) => block[1]);

for (const name of connections) {
	const body = typeBody(name);
	if (!body) continue;

	const fields = new Map(fieldsOf(body).map((field) => [field.name, field.type]));
	const missing = ['nodes', 'edges', 'totalCount', 'pageInfo'].filter((member) => !fields.has(member));
	const nullablePageInfo = fields.has('pageInfo') && !fields.get('pageInfo').endsWith('!');
	const carriesOldCount = fields.has('total') && !fields.has('totalCount');

	if (missing.length === 0 && !nullablePageInfo && !carriesOldCount) {
		if (LEGACY_CONNECTIONS.has(name)) {
			stale.push(`${name} is the canonical shape now — take it out of LEGACY_CONNECTIONS`);
		}
		continue;
	}

	if (!LEGACY_CONNECTIONS.has(name)) {
		failures.push(
			`${name} -> ${
				missing.length ? `missing ${missing.join(', ')}` : nullablePageInfo ? 'pageInfo is nullable' : 'spells the count `total`'
			}`
		);
	}
}

for (const name of BARE_ARRAYS) {
	if (!queryFields.some((field) => field.name === name && /^\[/.test(field.type))) {
		stale.push(`Query.${name} no longer returns a bare array — take it out of BARE_ARRAYS`);
	}
}

if (failures.length > 0) {
	console.error('FAILED — the list surface departs from the connection contract:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error('A list root field returns a connection; a connection carries nodes, edges, totalCount');
	console.error('and a non-null pageInfo; a count is nullable. A field that cannot follow the rule yet is');
	console.error('named in the two lists at the top of this file, with the reason it is still there.');
	process.exit(1);
}

if (stale.length > 0) {
	console.error('FAILED — the baseline describes a surface that has moved on:');
	for (const entry of stale) console.error(`  ${entry}`);
	console.error('');
	console.error('Remove each entry from the list it is in, so the gate keeps measuring what is left.');
	process.exit(1);
}

console.log(
	`PASSED — ${queryFields.length} root field(s) read: ${BARE_ARRAYS.size} list field(s) still answer a bare ` +
		`array and ${LEGACY_CONNECTIONS.size} of ${connections.length} connection type(s) are still not the ` +
		`canonical shape, both named in the baseline; every other list field is a connection and every other ` +
		`connection carries nodes, edges, totalCount and a non-null pageInfo.`
);
