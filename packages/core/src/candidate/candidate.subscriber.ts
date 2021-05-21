import { average } from "@gauzy/common";
import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
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
    }
}