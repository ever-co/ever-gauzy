import { Subject } from 'rxjs';
import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber, Organization } from '@gauzy/core';

/** The tax id of a Gauzy organization changed: its id, its tenant and the new value (in memory only). */
export interface OrganizationIdentifierChange {
	tenantId: string;
	organizationId: string;
	taxId: string | null;
}

/**
 * Organizations whose tax id changed. The ORMs make the subscriber below themselves, outside Nest,
 * so it only signals here; the discoverability handler of the module decides whether anything is
 * done (nothing unless the organization opted in to being discoverable).
 */
export const ORGANIZATION_IDENTIFIER_CHANGED = new Subject<OrganizationIdentifierChange>();

/**
 * Watches `Organization.taxId` (TypeORM and MikroORM). It reads nothing and writes nothing: a write
 * that does not change the tax id is ignored, and one that does only signals. Gauzy's own
 * organization subscriber is untouched.
 */
@EventSubscriber()
export class EverConnectOrganizationIdentifierSubscriber extends BaseEntityEventSubscriber<Organization> {
	/** The entities of writes that change the tax id, between their before and after hooks. */
	private readonly changing = new WeakSet<object>();

	listenTo() {
		return Organization;
	}

	async beforeEntityUpdate(entity: Organization, _em?: unknown, changedProperties?: string[]): Promise<void> {
		// Without the ORM's list of changed properties (a query builder update), the entity holds only
		// the values the write sets.
		const changes = changedProperties
			? changedProperties.includes('taxId')
			: Boolean(entity) && Object.prototype.hasOwnProperty.call(entity, 'taxId');
		if (changes && entity && typeof entity === 'object') {
			this.changing.add(entity);
		}
	}

	async afterEntityUpdate(entity: Organization): Promise<void> {
		if (!entity || typeof entity !== 'object' || !this.changing.has(entity)) {
			return;
		}
		this.changing.delete(entity);
		if (typeof entity.id === 'string' && typeof entity.tenantId === 'string') {
			ORGANIZATION_IDENTIFIER_CHANGED.next({
				tenantId: entity.tenantId,
				organizationId: entity.id,
				taxId: typeof entity.taxId === 'string' ? entity.taxId : null
			});
		}
	}
}
