import { MigrationInterface, QueryRunner, SelectQueryBuilder } from "typeorm";
import * as moment from 'moment';
import { isEmpty, isNotEmpty } from "@gauzy/common";
import { TimeLog, TimeSlot } from "./../../core/entities/internal";
    
export class AdjustTimeLogStopDate1644491785525 implements MigrationInterface {

    name = 'AdjustTimeLogStopDate1644491785525';
    
    public async up(queryRunner: QueryRunner): Promise<any> {
        const timeLogs = await queryRunner.connection.getRepository(TimeLog).find({
            where: (query: SelectQueryBuilder<TimeLog>) => {
                query.andWhere(`"${query.alias}"."stoppedAt" IS NULL`);
            },
            relations: ['timeSlots']
        });
        for await (const timeLog of timeLogs) {
            const logDifference = moment().diff(moment(timeLog.startedAt), 'minutes');
            if (
                isEmpty(timeLog.timeSlots) &&
                logDifference > 10
            ) {
                await queryRunner.connection.getRepository(TimeLog).save({
                    id: timeLog.id,
                    stoppedAt: timeLog.startedAt,
                    ...timeLog,
                });
            } else if (isNotEmpty(timeLog.timeSlots)) {
                const [lastTimeSlot] = timeLog.timeSlots.reverse();
                const slotDifference = moment().diff(moment(lastTimeSlot.stoppedAt), 'minutes');
                if (slotDifference > 10) {
                    await queryRunner.connection.getRepository(TimeLog).save({
                        id: timeLog.id,
                        stoppedAt: timeLog.startedAt
                    });
                }
            }
        }

        const timeSlots = await queryRunner.connection.getRepository(TimeSlot).find({
            where: (query: SelectQueryBuilder<TimeSlot>) => {
                query.orWhere(`"${query.alias}"."overall" < :overall`, {
                    overall: 0
                });
                query.orWhere(`"${query.alias}"."keyboard" < :keyboard`, {
                    keyboard: 0
                });
                query.orWhere(`"${query.alias}"."mouse" < :mouse`, {
                    mouse: 0
                });
                query.orWhere(`"${query.alias}"."duration" > :duration`, {
                    duration: 600
                });
            },
            relations: ['timeLogs']
        });

        for await (const timeSlot of timeSlots) {
            await queryRunner.connection.getRepository(TimeSlot).save({
                id: timeSlot.id,
                duration: (timeSlot.duration < 0) ? 0 : (timeSlot.duration > 600) ? 600 : timeSlot.duration,
                overall: (timeSlot.overall < 0) ? 0 : (timeSlot.overall > 600) ? 600 : timeSlot.overall,
                keyboard: (timeSlot.keyboard < 0) ? 0 : (timeSlot.keyboard > 600) ? 600 : timeSlot.keyboard,
                mouse: (timeSlot.mouse < 0) ? 0 : (timeSlot.mouse > 600) ? 600 : timeSlot.mouse
            });
        }
    }
    
    public async down(queryRunner: QueryRunner): Promise<any> {}
}