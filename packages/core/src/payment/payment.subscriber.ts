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
     * Called before payment insertion.
     */
    beforeInsert(event: InsertEvent<Payment>) {
        const entity = event.entity;
        if (entity) {
            entity.recordedById = RequestContext.currentUserId();
        }
    }
}