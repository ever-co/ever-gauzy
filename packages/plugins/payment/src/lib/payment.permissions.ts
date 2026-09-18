import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission values this package declares.
 *
 * The catalogue home of every value is `payment`: a provider registration, a collection, a session, a
 * capture, a refund and the inbound callback log are resources only this domain has, so they carry
 * their own values rather than borrowing a role definition from another package. The recorded
 * payment itself is the core `payment` row and stays under the platform's existing payment
 * permissions — there is no second payment table here, so there is no second payment permission.
 *
 * Two axes are deliberate. `PAYMENT_SESSIONS_CAPTURE` is separate from `PAYMENT_SESSIONS_AUTHORIZE`
 * because taking money is not the same act as reserving it, and `REFUNDS_APPROVE` is separate from
 * `REFUNDS_CREATE` because a refund above an agent's limit is somebody else's decision.
 *
 * The five remembered-payer values are the one place this map **reuses a platform code** rather than
 * minting one. The account at a provider and the instruments saved under it are kernel tables: their
 * permissions belong with them, in the platform catalogue, alongside the tables themselves, so the
 * role that may read a saved instrument is decided where the instrument is declared rather than in
 * whichever capability happens to expose it. The keys are stated here because this is the file whose
 * guards name them, and the values are the platform's own — the arrangement the warehouse package
 * uses for the codes the fulfilment domain publishes.
 */
export const PaymentPermission = {
	/** Read provider registrations and their non-secret configuration. */
	PAYMENT_PROVIDERS_VIEW: 'PAYMENT_PROVIDERS_VIEW',
	/** Register a provider against an existing integration. */
	PAYMENT_PROVIDERS_CREATE: 'PAYMENT_PROVIDERS_CREATE',
	/** Update a provider registration. */
	PAYMENT_PROVIDERS_EDIT: 'PAYMENT_PROVIDERS_EDIT',
	/** Remove a provider registration. */
	PAYMENT_PROVIDERS_DELETE: 'PAYMENT_PROVIDERS_DELETE',
	/** Read collections, sessions and their state. */
	PAYMENT_SESSIONS_VIEW: 'PAYMENT_SESSIONS_VIEW',
	/** Create a collection or a session, and authorise or refresh a session. */
	PAYMENT_SESSIONS_AUTHORIZE: 'PAYMENT_SESSIONS_AUTHORIZE',
	/** Capture an authorised amount, partially or in full. */
	PAYMENT_SESSIONS_CAPTURE: 'PAYMENT_SESSIONS_CAPTURE',
	/** Void an authorisation, or cancel a session. */
	PAYMENT_SESSIONS_CANCEL: 'PAYMENT_SESSIONS_CANCEL',
	/** Read refunds and the refund reasons. */
	REFUNDS_VIEW: 'REFUNDS_VIEW',
	/** Create a refund, cancel a pending one, and maintain the refund reasons. */
	REFUNDS_CREATE: 'REFUNDS_CREATE',
	/** Approve a pending refund. */
	REFUNDS_APPROVE: 'REFUNDS_APPROVE',
	/** Read the inbound provider callback log. */
	PAYMENT_CALLBACKS_VIEW: 'PAYMENT_CALLBACKS_VIEW',
	/** Re-process a failed or ignored provider callback. */
	PAYMENT_CALLBACKS_REPROCESS: 'PAYMENT_CALLBACKS_REPROCESS',
	/** Read a party's accounts at a provider and the instruments saved under them. */
	PAYMENT_ACCOUNT_HOLDERS_VIEW: PermissionsEnum.PAYMENT_ACCOUNT_HOLDERS_VIEW,
	/** Record, verify, edit and disable an account at a provider. */
	PAYMENT_ACCOUNT_HOLDERS_EDIT: PermissionsEnum.PAYMENT_ACCOUNT_HOLDERS_EDIT,
	/** Read the saved instruments of an account at a provider. */
	PAYMENT_METHOD_TOKENS_VIEW: PermissionsEnum.PAYMENT_METHOD_TOKENS_VIEW,
	/** Save an instrument from a provider-issued token, default it, and revoke it. */
	PAYMENT_METHOD_TOKENS_EDIT: PermissionsEnum.PAYMENT_METHOD_TOKENS_EDIT,
	/** Charge a saved instrument with nobody present, and read its stored reference. */
	PAYMENT_METHOD_TOKENS_CHARGE: PermissionsEnum.PAYMENT_METHOD_TOKENS_CHARGE
} as const;

/**
 * The permission catalogue entries this package contributes to the platform role model.
 *
 * `group` is the catalogue group a role editor lists the value under: the acts that change what the
 * platform may do with money without anybody present — registering a provider, capturing an
 * authorisation, approving a refund — sit under `ADMINISTRATION`, and reading and preparing sit under
 * `GENERAL`.
 */
export const PAYMENT_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: PaymentPermission.PAYMENT_PROVIDERS_VIEW,
		label: 'View payment providers',
		group: 'GENERAL',
		description: 'Read provider registrations, their availability lists and their non-secret configuration.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_PROVIDERS_CREATE,
		label: 'Register payment providers',
		group: 'ADMINISTRATION',
		description: 'Register a provider against an existing integration, so it can be offered at checkout.',
		defaultFor: ['SUPER_ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_PROVIDERS_EDIT,
		label: 'Edit payment providers',
		group: 'ADMINISTRATION',
		description: 'Update a provider registration: enable or disable it, change its availability and its configuration.',
		defaultFor: ['SUPER_ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_PROVIDERS_DELETE,
		label: 'Delete payment providers',
		group: 'ADMINISTRATION',
		description: 'Remove a provider registration that no session references.',
		defaultFor: ['SUPER_ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_SESSIONS_VIEW,
		label: 'View payment collections and sessions',
		group: 'GENERAL',
		description: 'Read collections, the attempts made against them and where each attempt stands.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE,
		label: 'Authorise payments',
		group: 'GENERAL',
		description: 'Create a collection and a session, and authorise or refresh a session at the provider.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_SESSIONS_CAPTURE,
		label: 'Capture payments',
		group: 'ADMINISTRATION',
		description: 'Take an authorised amount, partially or in full, and write the capture ledger row.',
		defaultFor: ['SUPER_ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_SESSIONS_CANCEL,
		label: 'Cancel payment sessions',
		group: 'GENERAL',
		description: 'Void an authorisation or cancel a session, releasing the money that was reserved.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PaymentPermission.REFUNDS_VIEW,
		label: 'View refunds',
		group: 'GENERAL',
		description: 'Read refunds and the governed refund reasons they cite.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PaymentPermission.REFUNDS_CREATE,
		label: 'Create refunds',
		group: 'GENERAL',
		description: 'Create a refund, cancel a pending one, and maintain the refund reasons.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PaymentPermission.REFUNDS_APPROVE,
		label: 'Approve refunds',
		group: 'ADMINISTRATION',
		description: 'Approve a pending refund that is above the limit of the role that created it.',
		defaultFor: ['SUPER_ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_CALLBACKS_VIEW,
		label: 'View provider callbacks',
		group: 'GENERAL',
		description: 'Read the inbound provider callback log, including the payload and the last error.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PaymentPermission.PAYMENT_CALLBACKS_REPROCESS,
		label: 'Reprocess provider callbacks',
		group: 'GENERAL',
		description: 'Re-run a failed or ignored provider callback through the same handler the intake uses.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	}
];
