import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
import { RequestContext } from "./../core/context";
import { Payment } from "./payment.entity";

@EventSubscriber()
export class PaymentSubscriber implements EntitySubscriberInterface<Payment> {

    /**
    * Indicates that this subscriber only listen to Payment events.
    */
    listenTo() {
        return Payment;
    }

    /**
     * Called before an entity is inserted into the database.
     *
     * @param event - The InsertEvent associated with the entity insertion.
     */
    beforeInsert(event: InsertEvent<Payment>): void | Promise<any> {
        try {
            if (event.entity) {
                event.entity.recordedById = RequestContext.currentUserId();
            }
        } catch (error) {
            console.error("Error in beforeInsert:", error.message);
        }
    }
}
