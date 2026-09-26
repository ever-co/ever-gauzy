import { PluginSettingContribution } from '@gauzy/plugin';
import { PaymentCaptureMode } from './payment.types';

/**
 * The settings this package reads.
 *
 * The declaration is metadata only: the value is always resolved through the platform settings store,
 * so an operator overrides any default below per tenant, per organization or per channel without a
 * code change. Two of them are channel settings on purpose — how money is taken is a property of the
 * sales surface (a card-not-present channel wants a manual capture window, a counter does not),
 * while the tolerances are properties of the installation.
 *
 * The keys are namespaced by concern (`payment.`) rather than by this package, so a channel that runs
 * two packages reads one vocabulary.
 */
export const PAYMENT_SETTINGS: PluginSettingContribution[] = [
	{
		key: 'payment.sessionTtlMinutes',
		type: 'number',
		default: 60,
		scope: 'TENANT',
		description:
			'How long a payment session may wait before it expires. The expiry sweep moves a session past this age to EXPIRED and, when the collection has no other usable attempt, releases what it was holding.'
	},
	{
		key: 'payment.webhookToleranceSeconds',
		type: 'number',
		default: 300,
		scope: 'TENANT',
		description:
			'The accepted clock skew of an inbound provider callback, in seconds. A signature whose timestamp falls outside this window is refused, which is what makes a captured callback useless to a replay.'
	},
	{
		key: 'payment.autoConfirmOffline',
		type: 'boolean',
		default: true,
		scope: 'ORGANIZATION',
		description:
			'Whether an offline movement — a bank transfer, cash or a cheque — is confirmed without waiting for a provider. When false, an offline capture or refund stays pending until an operator confirms it.'
	},
	{
		key: 'payment.refundWindowDays',
		type: 'number',
		default: 180,
		scope: 'TENANT',
		description:
			'How long after a capture a refund may still be attempted with the provider. Past this window the platform issues store credit instead of a provider refund, because the provider will no longer accept one.'
	},
	{
		key: 'payment.refundSlaHours',
		type: 'number',
		default: 72,
		scope: 'ORGANIZATION',
		description:
			'How long a refund may stay pending before it is reported as overdue on the payment it belongs to.'
	},
	{
		key: 'payment.tokenDeclineThreshold',
		type: 'number',
		default: 3,
		scope: 'TENANT',
		description:
			'How many declines in a row on one saved instrument move it to FAILED regardless of the decline class. A counter cache on the instrument is a cache; this is the threshold it is compared against.'
	},
	{
		key: 'payment.captureMode',
		type: 'string',
		default: PaymentCaptureMode.MANUAL,
		scope: 'CHANNEL',
		description:
			'Whether the channel authorises and captures in one provider call (AUTOMATIC) or authorises now and captures later (MANUAL).'
	},
	{
		key: 'payment.captureOn',
		type: 'string',
		default: 'FULFILLMENT',
		scope: 'CHANNEL',
		description:
			'What triggers the capture of an authorisation under MANUAL mode: the hand-over of the goods (FULFILLMENT) or an operator acting explicitly (OPERATOR).'
	},
	{
		key: 'payment.confirmOn',
		type: 'string',
		default: 'AUTHORIZATION',
		scope: 'CHANNEL',
		description:
			'When an order stops being pending: on the authorisation (AUTHORIZATION) or only once the money is captured (CAPTURE). Under MANUAL capture, CAPTURE keeps the order pending until the capture succeeds.'
	}
];
