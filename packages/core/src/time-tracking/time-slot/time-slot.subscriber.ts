import { EventSubscriber } from "typeorm";
import * as moment from 'moment';
import { ITimeSlot } from "@gauzy/contracts";
import { isNotEmpty } from "@gauzy/common";
import { TimeSlot } from "./time-slot.entity";
import { FileStorage } from "./../../core/file-storage";
import { BaseEntityEventSubscriber } from "../../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class TimeSlotSubscriber extends BaseEntityEventSubscriber<TimeSlot> {
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
    async afterEntityLoad(entity: TimeSlot): Promise<void> {
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
            console.error('TimeSlotSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }

    /**
     * Called after entity is removed from the database.
     *
     * @param entity
     * @param em
     */
    async afterEntityDelete(entity: TimeSlot): Promise<void> {
        try {
            const { screenshots } = entity ?? {};
            const entityId = entity?.id;

            if (entityId && Array.isArray(screenshots) && isNotEmpty(screenshots)) {
                console.log(`AFTER TIME_SLOT WITH ID ${entityId} REMOVED`);

                for await (const screenshot of screenshots) {
                    const instance = await new FileStorage().getProvider(screenshot?.storageProvider).getProviderInstance();
                    if (screenshot?.file) {
                        await instance.deleteFile(screenshot.file);
                    }
                    if (screenshot?.thumb) {
                        await instance.deleteFile(screenshot.thumb);
                    }
                }
            }
        } catch (error) {
            console.error('TimeSlotSubscriber: An error occurred during the afterEntityDelete process:', error);
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
