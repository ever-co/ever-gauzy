import { EventSubscriber } from 'typeorm';
import { Logger } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { Invoice } from './invoice.entity';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import {
	MikroOrmEntityManager,
	MultiOrmEntityManager,
	TypeOrmEntityManager
} from '../core/entities/subscribers/entity-event-subscriber.types';

@EventSubscriber()
export class InvoiceSubscriber extends BaseEntityEventSubscriber<Invoice> {
	private readonly logger = new Logger(`GZY - ${InvoiceSubscriber.name}`);

	/**
	 * Indicates that this subscriber only listen to Invoice events.
	 */
	listenTo() {
		return Invoice;
	}

	/**
	 * Sets the virtual field toOrganization on user own invoices
	 *
	 * @param {Invoice} invoice - The Invoice entity whose toOrganization needs to be set.
	 * @returns {Promise<void>} - Returns a promise indicating the completion of the operation.
	 */
	private async setFromOrganization(entity: Invoice): Promise<void> {
		if (entity?.fromUser) {
			entity.toOrganization = entity.fromOrganization;
			if (entity.fromOrganization) delete entity.fromOrganization;
			if (entity.fromOrganizationId) delete entity.fromOrganizationId;
		}
	}

	/**
	 * Called after an Invoice entity is created in the database. This method updates
	 * the entity by setting a generated token.
	 *
	 * @param entity The newly created Invoice entity.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM.
	 *           Used for executing the update operation.
	 * @returns {Promise<void>} A promise that resolves when the update operation is complete.
	 */
	async afterEntityCreate(entity: Invoice, em?: MultiOrmEntityManager): Promise<void> {
		try {
			const token = this.createToken({
				id: entity.id,
				organizationId: entity.organizationId,
				tenantId: entity.tenantId
			});

			// Update the Invoice entity with the generated token
			if (em instanceof TypeOrmEntityManager) {
				await em.update(Invoice, { id: entity.id }, { token });
			} else if (em instanceof MikroOrmEntityManager) {
				await em.nativeUpdate(Invoice, { id: entity.id }, { token });
			}
		} catch (error) {
			console.error('InvoiceSubscriber: Error during the afterEntityCreate process:', error);
		}
	}

	/**
	 * Called after an Invoice entity is loaded from the database.
	 *
	 * @param entity - The loaded Invoice entity.
	 * @param event - The LoadEvent associated with the entity loading.
	 */
	async afterEntityLoad(entity: Invoice): Promise<void> {
		try {
			// Set user own invoice the toOrganization virtual field
			if (Object.hasOwn(entity, 'fromUser')) {
				await this.setFromOrganization(entity);
			}
		} catch (error) {
			// Handle or log the error as needed
			this.logger.error('An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Generate a public invoice token.
	 *
	 * @param payload The data to be encoded in the JWT.
	 * @returns The generated JWT string.
	 */
	private createToken(payload: string | Buffer | object): string {
		const token: string = sign(payload, environment.JWT_SECRET, {});
		return token;
	}
}
