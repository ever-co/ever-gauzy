import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
import { sign } from 'jsonwebtoken';
import { environment } from "@gauzy/config";
import { Invoice } from "./invoice.entity";

@EventSubscriber()
export class InvoiceSubscriber implements EntitySubscriberInterface<Invoice> {

    /**
    * Indicates that this subscriber only listen to Invoice events.
    */
    listenTo() {
        return Invoice;
    }

    /**
     * Called after entity is inserted to the database.
     *
     * @param event
     */
    afterInsert(event: InsertEvent<Invoice>): void | Promise<any> {
        try {
            if (event.entity) {
                const { entity } = event;
                const payload = {
                    id: entity.id,
                    organizationId: entity.organizationId,
                    tenantId: entity.tenantId
                }
                event.manager.update(Invoice, entity.id, {
                    token: this.createToken(payload)
                });
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Generate public invoice token
     *
     * @param payload
     * @returns
     */
    createToken(payload: string | Buffer | object): string {
		const token: string = sign(payload, environment.JWT_SECRET, {});
		return token;
	}
}