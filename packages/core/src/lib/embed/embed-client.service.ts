import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { ID, IOrganizationContact } from '@gauzy/contracts';
import { OrganizationContact } from '../core/entities/internal';

/** The tenant and organization a credential belongs to. */
export interface IEmbedClientScope {
	tenantId: ID;
	organizationId: ID;
}

/** A client as an embed answer names it: its id and its name, nothing else. */
export type EmbedClient = Pick<IOrganizationContact, 'id' | 'name'>;

/**
 * The client (an organization contact) an embed credential is limited to. Read through TypeORM whichever ORM the
 * server runs, so both answer the same; a contact deleted (for good or softly) is no client.
 */
@Injectable()
export class EmbedClientService {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * A contact of the tenant and organization that is not deleted.
	 *
	 * @param id The contact's id.
	 * @param scope The credential's tenant and organization.
	 * @returns The client, or null for any other contact.
	 */
	async findClient(id: ID, scope: IEmbedClientScope): Promise<EmbedClient | null> {
		// TypeORM drops a condition whose value is undefined: without these, the read would match any contact.
		const namesContact = isUUID(id);
		const isScoped = Boolean(scope.tenantId) && Boolean(scope.organizationId);
		if (!namesContact || !isScoped) {
			return null;
		}
		const contact = await this.dataSource.getRepository(OrganizationContact).findOne({
			where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
			select: { id: true, name: true }
		});
		if (!contact) {
			return null;
		}
		return { id: contact.id, name: contact.name };
	}
}
