import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from "typeorm";
import * as moment from 'moment';
import { average } from "@gauzy/common";
import { CandidateStatusEnum } from "@gauzy/contracts";
import { Candidate } from "./candidate.entity";

@EventSubscriber()
export class CandidateSubscriber implements EntitySubscriberInterface<Candidate> {

    /**
    * Indicates that this subscriber only listen to Candidate events.
    */
    listenTo() {
        return Candidate;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: Candidate, event?: LoadEvent<Candidate>): void | Promise<any> {
        try {
            if (Array.isArray(entity.feedbacks)) {
                entity.ratings = average(entity.feedbacks, 'rating');
            }
            /**
             * If candidate already hired
             */
            entity.alreadyHired = (
                (entity.status === CandidateStatusEnum.HIRED) && (moment(entity.hiredDate).isValid())
            );
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Candidate>): void | Promise<any> {
        try {
            if (event.entity) {
                const { entity } = event;
                /**
                 * Automatically update candidate rejected status
                 */
                if ('rejectDate' in entity && moment(entity.rejectDate).isValid()) {
                    entity.status = CandidateStatusEnum.REJECTED;
                }
            }
        } catch (error) {
            console.log(error);
        }
    }
}