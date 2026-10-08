import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { EverConnectAuditService } from './ever-connect-audit.service';
import { GAUZY_OWNER_DELETED } from './ever-connect-deletion.subscriber';
import { EverConnectLinkService } from './ever-connect-link.service';
import { EverConnectPlatformService, errorCode, isCredentialRevoked } from './ever-connect-platform.service';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore, LinkRecord } from './ever-connect.store';
import { ProblemError } from './sdk';

/** A deletion signal is handled this long after it arrives (the deleting request finishes first). */
const DELETION_DELAY_MS = 1_000;

/**
 * What a deleted Gauzy tenant or organization leaves behind is removed (the plugin's tables have no
 * foreign keys to cascade): its link is removed on Ever Platform (best effort) and unlinked here, so
 * no document is fetched and no state is read for it any more, and its rows are removed from the
 * plugin's tables (links, integration states, lookup cache, audit). The installation keeps one audit
 * row saying a deleted organization's link was removed, without the organization's ids.
 *
 * It runs when Gauzy deletes a tenant or an organization through its entities, and before each
 * heartbeat, each read of the event feed and each re-read asked by a page, so a deletion made in any
 * other way is caught before anything is sent for that organization again.
 */
@Injectable()
export class EverConnectCleanupService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverConnect');
	private subscription: Subscription | null = null;
	private timer: NodeJS.Timeout | null = null;
	private running: Promise<number> | null = null;

	constructor(
		private readonly store: EverConnectStore,
		private readonly platform: EverConnectPlatformService,
		private readonly audit: EverConnectAuditService,
		private readonly links: EverConnectLinkService,
		private readonly signals: EverConnectSignals
	) {}

	onModuleInit(): void {
		this.subscription = GAUZY_OWNER_DELETED.subscribe(() => {
			if (this.timer) return;
			this.timer = setTimeout(() => {
				this.timer = null;
				this.reconcile().catch((error) =>
					this.logger.warn(`A deleted organization could not be cleaned up now (${errorCode(error)}).`)
				);
			}, DELETION_DELAY_MS);
			this.timer.unref?.();
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}

	/** Cleans up every deleted tenant and organization the plugin still holds rows of. Returns how many. */
	async reconcile(): Promise<number> {
		if (this.running) {
			return this.running;
		}
		this.running = this.reconcileOnce().finally(() => {
			this.running = null;
		});
		return this.running;
	}

	private async reconcileOnce(): Promise<number> {
		const owners = await this.store.deletedOwners();
		for (const owner of owners) {
			for (const link of await this.store.linksOf(owner)) {
				const remote = await this.removeRemotely(link);
				await this.links.unlinkLocally(link, 'system', null, remote);
				await this.audit.record({
					action: 'link.purge',
					actorLabel: 'system',
					details: { link_id: link.linkId, reason: 'organization_deleted', remote }
				});
			}
			await this.store.purgeOwner(owner);
			await this.audit.purge(owner);
		}
		return owners.length;
	}

	/** `DELETE /v1/instances/me/tenant-links/{link}` for a live link (best effort). */
	private async removeRemotely(link: LinkRecord): Promise<boolean> {
		if (link.status === 'unlinked') {
			return false;
		}
		const connection = await this.store.connection();
		if (connection.status !== 'connected') {
			return false;
		}
		try {
			await (await this.platform.getClient()).instances.tenantLinks.remove(link.linkId);
			return true;
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return false;
			}
			if (error instanceof ProblemError && error.status === 404) {
				return true;
			}
			this.logger.warn(
				`Ever Platform was not told that a deleted organization's link is removed (${errorCode(error)}); it is removed here.`
			);
			return false;
		}
	}
}
