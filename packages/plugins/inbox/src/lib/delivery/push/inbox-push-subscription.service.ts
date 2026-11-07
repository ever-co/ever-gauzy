import { createHash } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ID, IInboxPushSubscription, IInboxPushSubscriptionInput } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { InboxPushSubscription } from './inbox-push-subscription.entity';
import { INBOX_PUSH_MAX_FAILURES, readInboxWebPushConfig } from './inbox-push.constants';

/** The key a device is known by: the SHA-256 of its endpoint, hex. */
export function endpointHashOf(endpoint: string): string {
	return createHash('sha256').update(endpoint).digest('hex');
}

/**
 * The person's subscribed devices (FR-13): registered, listed and removed by the person themselves; read, marked and
 * removed by the delivery sweep. A device is known by its endpoint: registering it again refreshes its keys and starts
 * its failure count over.
 */
@Injectable()
export class InboxPushSubscriptionService {
	constructor(private readonly dataSource: DataSource) {}

	private get repository() {
		return this.dataSource.getRepository(InboxPushSubscription);
	}

	/** The VAPID public key a browser subscribes with, or null when nothing is pushed. */
	publicKey(): string | null {
		return readInboxWebPushConfig()?.publicKey ?? null;
	}

	/** The caller: a signed-in user of the tenant, with their employee record when they have one. */
	private caller(): { tenantId: ID; userId: ID; organizationId: ID | null; employeeId: ID | null } {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		if (!tenantId || !userId) {
			throw new ForbiddenException('A signed-in user of the tenant is required.');
		}
		return {
			tenantId,
			userId,
			organizationId: RequestContext.currentOrganizationId() ?? null,
			employeeId: (RequestContext.currentUser()?.employeeId as ID | undefined) ?? null
		};
	}

	/** Registers the caller's device, or refreshes the one the endpoint names (new keys, failures cleared). */
	async register(input: IInboxPushSubscriptionInput): Promise<IInboxPushSubscription> {
		const { tenantId, userId, organizationId, employeeId } = this.caller();
		const endpointHash = endpointHashOf(input.endpoint);
		const expirationTime = typeof input.expirationTime === 'number' && input.expirationTime > 0 ? new Date(input.expirationTime) : null;
		const userAgent = String(input.userAgent ?? '').trim().slice(0, 255) || null;
		const existing = await this.repository.findOne({ where: { tenantId, userId, endpointHash } });
		if (existing) {
			await this.repository.update(
				{ id: existing.id },
				{
					endpoint: input.endpoint,
					p256dh: input.keys.p256dh,
					auth: input.keys.auth,
					expirationTime: expirationTime as never,
					userAgent: userAgent as never,
					employeeId: (employeeId ?? null) as never,
					failures: 0
				} as never
			);
			return (await this.repository.findOne({ where: { id: existing.id } })) as InboxPushSubscription;
		}
		return this.repository.save(
			this.repository.create({
				tenantId,
				organizationId: organizationId ?? undefined,
				userId,
				employeeId: employeeId ?? undefined,
				endpoint: input.endpoint,
				endpointHash,
				p256dh: input.keys.p256dh,
				auth: input.keys.auth,
				expirationTime: expirationTime ?? undefined,
				userAgent: userAgent ?? undefined,
				failures: 0
			})
		);
	}

	/** The caller's devices, newest first. */
	async listMine(): Promise<IInboxPushSubscription[]> {
		const { tenantId, userId } = this.caller();
		return this.repository.find({ where: { tenantId, userId }, order: { createdAt: 'DESC' } });
	}

	/** Removes one of the caller's devices; another person's is not found. */
	async remove(id: ID): Promise<void> {
		const { tenantId, userId } = this.caller();
		const row = await this.repository.findOne({ where: { id, tenantId, userId } });
		if (!row) {
			throw new NotFoundException('The push subscription does not exist, or it is not yours.');
		}
		await this.repository.delete({ id: row.id });
	}

	// ---------------------------------------------------------------- the sweep's reads and marks

	/** Whether the person has a device subscribed (the opt-in the push decision reads). */
	async hasAny(tenantId: ID, userId: ID): Promise<boolean> {
		return this.repository.exists({ where: { tenantId, userId } });
	}

	/** The person's devices, oldest first. */
	async devicesOf(tenantId: ID, userId: ID): Promise<InboxPushSubscription[]> {
		return this.repository.find({ where: { tenantId, userId }, order: { createdAt: 'ASC' } });
	}

	/** A push the service accepted: the device is in use, and its failures are over. */
	async markUsed(id: ID, now: Date): Promise<void> {
		await this.repository.update({ id }, { lastUsedAt: now, failures: 0 } as never);
	}

	/** The push service no longer knows the device: it is removed. */
	async gone(id: ID): Promise<void> {
		await this.repository.delete({ id });
	}

	/** A push the service refused: one more failure; at the limit the device is removed. Answers whether it was. */
	async recordFailure(device: Pick<InboxPushSubscription, 'id' | 'failures'>): Promise<boolean> {
		const failures = (Number(device.failures) || 0) + 1;
		if (failures >= INBOX_PUSH_MAX_FAILURES) {
			await this.repository.delete({ id: device.id });
			return true;
		}
		await this.repository.update({ id: device.id }, { failures } as never);
		return false;
	}
}
