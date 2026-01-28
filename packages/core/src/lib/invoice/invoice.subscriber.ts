import { EventSubscriber } from 'typeorm';
import { sign } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { Invoice } from './invoice.entity';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { getORMType, MultiORM, MultiORMEnum } from '../core/utils';
import {
	MikroOrmEntityManager,
	MultiOrmEntityManager,
	TypeOrmEntityManager
} from '../core/entities/subscribers/entity-event-subscriber.types';

/**
 * Payload structure for generating invoice tokens.
 */
interface InvoiceTokenPayload {
	id: string;
	organizationId: string;
	tenantId: string;
}

@EventSubscriber()
export class InvoiceSubscriber extends BaseEntityEventSubscriber<Invoice> {
	/**
	 * Indicates that this subscriber only listen to Invoice events.
	 */
	listenTo() {
		return Invoice;
	}

	/**
	 * Validates the entity manager matches the expected ORM type.
	 *
	 * @param em The entity manager to validate
	 * @param ormType The expected ORM type
	 * @returns True if the entity manager matches the expected ORM type
	 */
	private isValidEntityManager(em: MultiOrmEntityManager | undefined, ormType: MultiORM): boolean {
		if (!em) return false;

		switch (ormType) {
			case MultiORMEnum.TypeORM:
				return em instanceof TypeOrmEntityManager;
			case MultiORMEnum.MikroORM:
				return em instanceof MikroOrmEntityManager;
			default:
				return false;
		}
	}

	/**
	 * Updates the invoice entity with the generated token based on the ORM type.
	 *
	 * @param em The entity manager (TypeORM or MikroORM)
	 * @param entityId The invoice entity ID
	 * @param token The generated token to update
	 * @param ormType The ORM type being used
	 */
	private async updateInvoiceToken(
		em: MultiOrmEntityManager,
		entityId: string,
		token: string,
		ormType: MultiORM
	): Promise<void> {
		switch (ormType) {
			case MultiORMEnum.TypeORM:
				if (em instanceof TypeOrmEntityManager) {
					await em.update(Invoice, { id: entityId }, { token });
				}
				break;
			case MultiORMEnum.MikroORM:
				if (em instanceof MikroOrmEntityManager) {
					await em.nativeUpdate(Invoice, { id: entityId }, { token });
				}
				break;
			default:
				console.warn(`InvoiceSubscriber: Unsupported ORM type: ${ormType}`);
				break;
		}
	}

	/**
	 * Called after an Invoice entity is created in the database. This method updates
	 * the entity by setting a generated token for public access.
	 *
	 * @param entity The newly created Invoice entity.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>} A promise that resolves when the update operation is complete.
	 */
	async afterEntityCreate(entity: Invoice, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (!(entity instanceof Invoice)) {
				return; // Early exit if the entity is not an Invoice
			}

			// Get ORM type dynamically at runtime to ensure correct environment selection
			const ormType = getORMType();

			// Validate entity manager matches the ORM type
			if (!this.isValidEntityManager(em, ormType)) {
				console.warn('InvoiceSubscriber: Entity manager is not available or type mismatch.');
				return;
			}

			// Generate token with invoice payload
			const token = this.createToken({
				id: entity.id,
				organizationId: entity.organizationId,
				tenantId: entity.tenantId
			});

			// Update the Invoice entity with the generated token
			await this.updateInvoiceToken(em, entity.id, token, ormType);
		} catch (error) {
			console.error('InvoiceSubscriber: Error during the afterEntityCreate process:', error);
		}
	}

	/**
	 * Generates a JWT token for public invoice access.
	 *
	 * @param payload The invoice data to be encoded in the JWT.
	 * @returns The generated JWT string.
	 */
	private createToken(payload: InvoiceTokenPayload): string {
		return sign(payload, environment.JWT_SECRET, {});
	}
}
