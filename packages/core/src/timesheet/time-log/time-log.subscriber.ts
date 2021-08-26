import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
import * as moment from 'moment';
import { TimeLog } from "./../time-log.entity";

@EventSubscriber()
export class TimeLogSubscriber implements EntitySubscriberInterface<TimeLog> {
    /**
    * Indicates that this subscriber only listen to TimeLog events.
    */
    listenTo() {
        return TimeLog;
    }

    /**
    * Called after entity is loaded.
    */
    afterLoad(entity: TimeLog) {
       const startedAt = moment(entity.startedAt, 'YYYY-MM-DD HH:mm:ss');
       const stoppedAt = moment(entity.stoppedAt || new Date(), 'YYYY-MM-DD HH:mm:ss');
       entity.duration = stoppedAt.diff(startedAt, 'seconds');
    }
}