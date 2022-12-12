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
     * Called before entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Payment>): void | Promise<any> {
        try {
            const entity = event.entity;
            if (entity) { entity.recordedById = RequestContext.currentUserId(); }
        } catch (error) {
            console.log(error);
        }
    }
}