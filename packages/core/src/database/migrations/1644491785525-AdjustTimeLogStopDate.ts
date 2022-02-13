import { MigrationInterface, QueryRunner, SelectQueryBuilder } from "typeorm";
import { chain } from 'underscore';
import * as moment from 'moment';
import { isEmpty, isNotEmpty } from "@gauzy/common";
import { TimeSlot } from "./../../core/entities/internal";
    
export class AdjustTimeLogStopDate1644491785525 implements MigrationInterface {

    name = 'AdjustTimeLogStopDate1644491785525';
    
    public async up(queryRunner: QueryRunner): Promise<any> {
        const timelogs = await queryRunner.connection.manager.query(`
            SELECT 
                "time_log"."id" AS "time_log_id",
                "time_slot"."id" AS "time_slot_id"
            FROM "time_log"
            LEFT JOIN "time_slot_time_logs" 
                ON "time_slot_time_logs"."timeLogId" = "time_log"."id" 
            LEFT JOIN "time_slot"
                ON "time_slot"."id" = "time_slot_time_logs"."timeSlotId"
            WHERE 
                "time_log"."stoppedAt" IS NULL
        `);
        const timeLogs = chain(timelogs).groupBy((log: any) => log.time_log_id).value();
        for await (const [timeLogId, timeSlots] of Object.entries(timeLogs)) {
            const timeSlotsIds = timeSlots.map(
                (timeSlot: any) => timeSlot.time_slot_id
            ).filter(Boolean);
            const [timeLog] = await queryRunner.connection.manager.query(`
                SELECT * FROM "time_log" WHERE "time_log"."id" = $1 LIMIT 1`, 
                [
                    timeLogId
                ]
            );
            const logDifference = moment().diff(moment(timeLog.startedAt), 'minutes');
            if (
                isEmpty(timeSlotsIds) &&
                logDifference > 10
            ) {
                await queryRunner.connection.manager.query(`
                    UPDATE "time_log" SET 
                        "stoppedAt" = $1, 
                        "updatedAt" = CURRENT_TIMESTAMP 
                    WHERE 
                        "id" IN($2) 
                    RETURNING "updatedAt"`, 
                    [
                        timeLog.startedAt,
                        timeLog.id
                    ]
                );
            } else if (isNotEmpty(timeSlotsIds)) {
                const [lastTimeSlot] = await queryRunner.connection.manager.query(`
                    SELECT * FROM 
                        "time_slot" 
                    WHERE 
                        "time_slot"."id" IN ('${timeSlotsIds.join("','")}') 
                    ORDER BY 
                        "time_slot"."startedAt" DESC
                `);
                const stoppedAt = moment(lastTimeSlot.startedAt).add(10, 'minutes').toDate();
                const slotDifference = moment().diff(moment(stoppedAt), 'minutes');
                if (slotDifference > 10) {
                    await queryRunner.connection.manager.query(`
                        UPDATE "time_log" SET
                            "stoppedAt" = $1,
                            "updatedAt" = CURRENT_TIMESTAMP 
                        WHERE 
                            "id" IN($2) 
                        RETURNING "updatedAt"`,
                        [
                            stoppedAt,
                            timeLog.id
                        ]
                    );
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
            }
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