import { EntitySubscriberInterface, EventSubscriber, LoadEvent, RemoveEvent } from "typeorm";
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
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: TimeSlot, event?: LoadEvent<TimeSlot>): void | Promise<any> {
        try {
            if ('startedAt' in entity) {
                entity.stoppedAt = moment(entity.startedAt).add(10, 'minutes').toDate();
            }
            /***
             * Calculate activities in percentage
             */
            if ('overall' in entity) {
                entity.percentage = this.calculateOverallActivity(entity);
            }
            if ('keyboard' in entity) {
                entity.keyboardPercentage = this.calculateKeyboardActivity(entity);
            }
            if ('mouse' in entity) {
                entity.mousePercentage = this.calculateMouseActivity(entity);
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called after entity is removed from the database.
     *
     * @param event
     */
    async afterRemove(event: RemoveEvent<TimeSlot>): Promise<any | void> {
        try {
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
        } catch (error) {
            console.log(error);
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