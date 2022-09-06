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
        /***
         * Calculate activities in percentage
         */
        entity.percentage = this.calculateOverallActivity(entity);
        entity.keyboardPercentage = this.calculateKeyboardActivity(entity);
        entity.mousePercentage = this.calculateMouseActivity(entity);
    }

    /**
     * Called after entity removal.
     */
    async afterRemove(event: RemoveEvent<TimeSlot>) {
        if (event.entityId && event.entity.screenshots) {
            const { screenshots } = event.entity;
            console.log(`AFTER TIME_SLOT WITH ID ${event.entityId} REMOVED`);
            if (screenshots instanceof Array && isNotEmpty(screenshots)) {
                for await (const screenshot of screenshots) {
                    const instance = await new FileStorage().getProvider(screenshot.storageProvider).getInstance();
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

    /**
     * Calculate overall activity in percentage
     *
     * @param entity
     * @returns
     */
    private calculateOverallActivity(entity: ITimeSlot): number {
        return parseFloat(
            Math.round(((entity.overall * 100) / (entity.duration))).toFixed(2)
        ) || 0;
    }

    /**
     * Calculate mouse activity in percentage
     *
     * @param entity
     * @returns
     */
    private calculateMouseActivity(entity: ITimeSlot): number {
        return parseFloat(
            Math.round(((entity.mouse * 100) / (entity.duration))).toFixed(2)
        ) || 0;
    }

    /**
     * Calculate keyboard activity in percentage
     *
     * @param entity
     * @returns
     */
    private calculateKeyboardActivity(entity: ITimeSlot): number {
        return parseFloat(
            Math.round(((entity.keyboard * 100) / (entity.duration))).toFixed(2)
        ) || 0;
    }
}