import { EventSubscriber } from "typeorm";
import { sign } from 'jsonwebtoken';
import { environment } from "@gauzy/config";
import { Invoice } from "./invoice.entity";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { MikroOrmEntityManager, MultiOrmEntityManager, TypeOrmEntityManager } from "../core/entities/subscribers/entity-event-subscriber.types";

@EventSubscriber()
export class InvoiceSubscriber extends BaseEntityEventSubscriber<Invoice> {

    /**
    * Indicates that this subscriber only listen to Invoice events.
    */
    listenTo() {
        return Invoice;
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
            const payload = {
                id: entity.id,
                organizationId: entity.organizationId,
                tenantId: entity.tenantId
            };

            const token = this.createToken(payload);

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
