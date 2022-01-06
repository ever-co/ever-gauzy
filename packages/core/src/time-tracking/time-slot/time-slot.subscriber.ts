import { EntitySubscriberInterface, EventSubscriber, RemoveEvent } from "typeorm";
import * as moment from 'moment';
import { ITimeSlot } from "@gauzy/contracts";
import { isNotEmpty } from "@gauzy/common";
import { TimeSlot } from "./time-slot.entity";
import { FileStorage } from "./../../core/file-storage";

@EventSubscriber()
export class TimeSlotSubscriber implements EntitySubscriberInterface<TimeSlot> {
    /**
    * Indicates that this subscriber only listen to TimeSlot events.
    */
    listenTo() {
        return TimeSlot;
    }

    /**
    * Called after entity is loaded.
    */
    afterLoad(entity: TimeSlot) {
		entity.stoppedAt = moment(entity.startedAt).add(10, 'minutes').toDate();
        entity.percentage = this.calculateActivityPercentage(entity);
    }

    /**
     * Called after entity removal.
     */
    async afterRemove(event: RemoveEvent<TimeSlot>) {
        if (event.entityId && event.entity.screenshots) {
            const { screenshots } = event.entity;
            console.log(`AFTER TIME_SLOT WITH ID ${event.entityId} REMOVED: `, event.entity.screenshots);
            if (screenshots instanceof Array && isNotEmpty(screenshots)) {
                for await (const screenshot of screenshots) {
                    const instance = await new FileStorage().getProvider().getInstance();
                    if (screenshot.file) {
                        instance.deleteFile(screenshot.file);
                    }
                    if (screenshot.thumb) {
                        instance.deleteFile(screenshot.thumb);
                    }
                }
            }
        }
    }

    private calculateActivityPercentage(entity: ITimeSlot): number {
        return parseFloat(
            Math.round(((entity.overall * 100) / (entity.duration))).toFixed(2)
        ) || 0;
    }
}