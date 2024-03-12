import { EventSubscriber } from "typeorm";
import { RequestContext } from "./../core/context";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { Payment } from "./payment.entity";

@EventSubscriber()
export class PaymentSubscriber extends BaseEntityEventSubscriber<Payment> {

    /**
    * Indicates that this subscriber only listen to Payment events.
    */
    listenTo() {
        return Payment;
    }

    /**
     * Called before an entity is inserted/created into the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: Payment): Promise<void> {
        try {
            if (entity) {
                entity.recordedById = RequestContext.currentUserId();
            }
        } catch (error) {
            console.error("Error in PaymentSubscriber beforeEntityCreate:", error.message);
        }
    }
}
