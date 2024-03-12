import { EventSubscriber } from "typeorm";
import * as moment from 'moment';
import { average } from "@gauzy/common";
import { CandidateStatusEnum } from "@gauzy/contracts";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { Candidate } from "./candidate.entity";

@EventSubscriber()
export class CandidateSubscriber extends BaseEntityEventSubscriber<Candidate> {

    /**
    * Indicates that this subscriber only listen to Candidate events.
    */
    listenTo() {
        return Candidate;
    }

    /**
     * Processes a Candidate entity after it's loaded.
     * This function calculates the average rating from the candidate's feedbacks if they are available.
     * It also sets the 'alreadyHired' property based on the candidate's status and the validity of the hiredDate.
     *
     * @param entity The Candidate entity that has been loaded.
     */
    async afterEntityLoad(entity: Candidate): Promise<void> {
        try {
            // Calculate the average rating if feedbacks are available and in array format.
            if (Array.isArray(entity.feedbacks)) {
                // Assuming `average` is a function that calculates the average rating.
                // 'rating' is presumably a property within each feedback object.
                entity.ratings = average(entity.feedbacks, 'rating');
            }

            // Set alreadyHired to true if the candidate's status is HIRED and the hiredDate is a valid date.
            entity.alreadyHired = entity.status === CandidateStatusEnum.HIRED && moment(entity.hiredDate).isValid();
        } catch (error) {
            console.error('CandidateSubscriber: Error during the afterEntityLoad process:', error);
        }
    }

    /**
     * Performs preprocessing on a Candidate entity before its creation.
     * This function checks if a rejectDate is present and valid for the candidate,
     * and if so, updates the candidate's status to REJECTED.
     *
     * @param entity The Candidate entity that is about to be created.
     */
    async beforeEntityCreate(entity: Candidate): Promise<void> {
        try {
            if (entity) {
                // Check if rejectDate is present and is a valid date. If true, update the candidate's status to REJECTED.
                if ('rejectDate' in entity && moment(entity.rejectDate).isValid()) {
                    entity.status = CandidateStatusEnum.REJECTED;
                }
            }
        } catch (error) {
            console.error('CandidateSubscriber: Error during the beforeEntityCreate process:', error);
        }
    }
}
