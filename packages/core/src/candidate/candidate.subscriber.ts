import { average } from "@gauzy/common";
import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
import * as moment from 'moment';
import { CandidateStatusEnum } from "@gauzy/contracts";
import { getUserDummyImage } from "./../core/utils";
import { Candidate } from "./../core/entities/internal";

@EventSubscriber()
export class CandidateSubscriber implements EntitySubscriberInterface<Candidate> {

    /**
    * Indicates that this subscriber only listen to Candidate events.
    */
    listenTo() {
        return Candidate;
    }

    /**
    * Called after entity is loaded.
    */
    afterLoad(entity: Candidate) {
        if (Array.isArray(entity.feedbacks)) {
			entity.ratings = average(entity.feedbacks, 'rating');
		}
        /**
         * If candidate already hired
         */
        entity.alreadyHired = (
            (entity.status === CandidateStatusEnum.HIRED) && 
            (moment(entity.hiredDate).isValid())
        );
    }

    /**
    * Called before candidate insertion.
    */
    beforeInsert(event: InsertEvent<Candidate>) {
        if (event.entity) {
            const { entity } = event;
            /**
             * Use a dummy image avatar if no image is uploaded for any of the candidate
             */
            if (!entity.user.imageUrl) {
                entity.user.imageUrl = getUserDummyImage(entity.user)
            }

            /**
             * Automatically update candidate rejected status
             */
            if (moment(entity.rejectDate).isValid()) {
                entity.status = CandidateStatusEnum.REJECTED;
            }
        }
    }
}