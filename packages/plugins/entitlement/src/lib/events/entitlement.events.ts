import { BaseEvent } from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementActivation } from '../entitlement-activation/entitlement-activation.entity';

/**
 * The in-process notifications the GraphQL subscription fields carry.
 *
 * They are deliberately not the durable events: the outbox rows are the system of record and every
 * consumer that must not miss one registers for them, while these three exist so that an open
 * subscription sees a change without polling. Each carries identity and the little a client needs to
 * decide whether to re-read, never a copy of the row — a subscriber that acts on a snapshot of a row
 * that has moved on is the classic way an event becomes a second, staler database.
 */

/**
 * Raised when a right changed in a way a client should re-read: it was granted, suspended, resumed,
 * extended, reduced or had a slot given back.
 */
export class EntitlementChangedEvent extends BaseEvent {
	/**
	 * @param entitlementId The right that changed.
	 * @param organizationId The organization it belongs to, which scopes the stream.
	 */
	constructor(
		public readonly entitlementId: ID,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param entitlement The right that changed.
	 * @returns The event describing it.
	 */
	static from(entitlement: Entitlement): EntitlementChangedEvent {
		return new EntitlementChangedEvent(entitlement.id, entitlement.organizationId);
	}
}

/**
 * Raised when a device, instance or named user occupied a slot.
 *
 * The payload names the activation rather than carrying it: a subscriber that wants the row reads it
 * through the service, under its own permissions.
 */
export class EntitlementActivatedEvent extends BaseEvent {
	/**
	 * @param entitlementId The right that was activated against.
	 * @param activationId The activation that took the slot.
	 * @param deviceId The device that took it.
	 * @param organizationId The organization the right belongs to.
	 */
	constructor(
		public readonly entitlementId: ID,
		public readonly activationId: ID,
		public readonly deviceId: string,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param activation The activation that was created.
	 * @param entitlement The right it occupies a slot of.
	 * @returns The event describing it.
	 */
	static from(activation: EntitlementActivation, entitlement: Entitlement): EntitlementActivatedEvent {
		return new EntitlementActivatedEvent(
			entitlement.id,
			activation.id,
			activation.deviceId,
			entitlement.organizationId
		);
	}
}

/**
 * Raised when a right was withdrawn.
 *
 * Withdrawal is terminal, so a client that subscribed to notice it does not have to poll for the
 * terminal state — which is the one thing a licence check must not get wrong.
 */
export class EntitlementRevokedEvent extends BaseEvent {
	/**
	 * @param entitlementId The right that was withdrawn.
	 * @param revokedReason Why.
	 * @param organizationId The organization the right belongs to.
	 */
	constructor(
		public readonly entitlementId: ID,
		public readonly revokedReason: string,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param entitlement The withdrawn right.
	 * @returns The event describing it.
	 */
	static from(entitlement: Entitlement): EntitlementRevokedEvent {
		return new EntitlementRevokedEvent(
			entitlement.id,
			entitlement.revokedReason ?? '',
			entitlement.organizationId
		);
	}
}
