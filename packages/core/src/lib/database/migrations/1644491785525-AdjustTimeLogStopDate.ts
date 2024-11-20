import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { chain } from 'underscore';
import * as moment from 'moment';
import { isEmpty, isNotEmpty } from "@gauzy/common";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AdjustTimeLogStopDate1644491785525 implements MigrationInterface {

    name = 'AdjustTimeLogStopDate1644491785525';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' start running!'));

        switch (queryRunner.connection.options.type) {
            case DatabaseTypeEnum.sqlite:
            case DatabaseTypeEnum.betterSqlite3:
                await this.sqliteUpQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.postgres:
                await this.postgresUpQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                await this.mysqlUpQueryRunner(queryRunner);
                break;
            default:
                throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    }
    /**
     * Down Migration
     *
     * @param queryRunner
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        switch (queryRunner.connection.options.type) {
            case DatabaseTypeEnum.sqlite:
            case DatabaseTypeEnum.betterSqlite3:
                await this.sqliteDownQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.postgres:
                await this.postgresDownQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                await this.mysqlDownQueryRunner(queryRunner);
                break;
            default:
                throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    }

    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        const timeSlots = await queryRunner.connection.manager.query(`
            SELECT * FROM
                "time_slot"
            WHERE
                "time_slot"."overall" < ? OR
                "time_slot"."keyboard" < ? OR
                "time_slot"."mouse" < ? OR
                "time_slot"."duration" > ?;
        `,
            [0, 0, 0, 600]
        );
        for await (const timeSlot of timeSlots) {
            const duration = (timeSlot.duration < 0) ? 0 : (timeSlot.duration > 600) ? 600 : timeSlot.duration;
            const overall = (timeSlot.overall < 0) ? 0 : (timeSlot.overall > 600) ? 600 : timeSlot.overall;
            const keyboard = (timeSlot.keyboard < 0) ? 0 : (timeSlot.keyboard > 600) ? 600 : timeSlot.keyboard;
            const mouse = (timeSlot.mouse < 0) ? 0 : (timeSlot.mouse > 600) ? 600 : timeSlot.mouse;
            await queryRunner.connection.manager.query(`
                UPDATE "time_slot" SET
                    "duration" = ?,
                    "overall" = ?,
                    "keyboard" = ?,
                    "mouse" = ?
                WHERE
                    "id" IN(?)`,
                [duration, overall, keyboard, mouse, timeSlot.id]
            );
        }

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
            const timeSlotsIds = timeSlots
                .map(
                    (timeSlot: any) => timeSlot.time_slot_id
                )
                .filter(Boolean);
            const [timeLog] = await queryRunner.connection.manager.query(
                `SELECT * FROM "time_log" WHERE "time_log"."id" = ? LIMIT 1`,
                [timeLogId]
            );

            const logDifference = moment().diff(moment.utc(timeLog.startedAt), 'minutes');
            if (
                isEmpty(timeSlotsIds) &&
                logDifference > 10
            ) {
                await queryRunner.connection.manager.query(
                    `UPDATE "time_log" SET
                        "stoppedAt" = ?
                    WHERE
                        "id" IN(?)`,
                    [timeLog.startedAt, timeLog.id]
                );
            } else if (isNotEmpty(timeSlotsIds)) {
                const timeSlots = await queryRunner.connection.manager.query(`
                    SELECT * FROM
                        "time_slot"
                    WHERE
                        "time_slot"."id" IN ('${timeSlotsIds.join("','")}')
                    ORDER BY
                        "time_slot"."startedAt" DESC
                `);
                let stoppedAt: any;
                let slotDifference: any;

                const [lastTimeSlot] = timeSlots;
                const duration = timeSlots.reduce((sum: number, current: any) => sum + current.duration, 0);
                /**
                 * Adjust stopped date as per database selection
                 */
                stoppedAt = moment.utc(lastTimeSlot.startedAt)
                    .add(duration, 'seconds')
                    .format('YYYY-MM-DD HH:mm:ss.SSS');
                slotDifference = moment.utc(moment()).diff(stoppedAt, 'minutes');
                if (slotDifference > 10) {
                    await queryRunner.connection.manager.query(`
                        UPDATE "time_log" SET
                            "stoppedAt" = ?
                        WHERE
                            "id" IN(?)`,
                        [stoppedAt, timeLog.id]
                    );
                }
            }
        }
    }

    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        const timeSlots = await queryRunner.connection.manager.query(`
            SELECT * FROM
                "time_slot"
            WHERE
                "time_slot"."overall" < $1 OR
                "time_slot"."keyboard" < $2 OR
                "time_slot"."mouse" < $3 OR
                "time_slot"."duration" > $4;
        `,
            [0, 0, 0, 600]
        );
        for await (const timeSlot of timeSlots) {
            const duration = (timeSlot.duration < 0) ? 0 : (timeSlot.duration > 600) ? 600 : timeSlot.duration;
            const overall = (timeSlot.overall < 0) ? 0 : (timeSlot.overall > 600) ? 600 : timeSlot.overall;
            const keyboard = (timeSlot.keyboard < 0) ? 0 : (timeSlot.keyboard > 600) ? 600 : timeSlot.keyboard;
            const mouse = (timeSlot.mouse < 0) ? 0 : (timeSlot.mouse > 600) ? 600 : timeSlot.mouse;
            await queryRunner.connection.manager.query(`
                UPDATE "time_slot" SET
                    "duration" = $1,
                    "overall" = $2,
                    "keyboard" = $3,
                    "mouse" = $4
                WHERE
                    "id" IN($5)`,
                [duration, overall, keyboard, mouse, timeSlot.id]
            );
        }

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
            const timeSlotsIds = timeSlots
                .map(
                    (timeSlot: any) => timeSlot.time_slot_id
                )
                .filter(Boolean);
            const [timeLog] = await queryRunner.connection.manager.query(
                `SELECT * FROM "time_log" WHERE "time_log"."id" = $1 LIMIT 1`,
                [timeLogId]
            );

            const logDifference = moment().diff(moment.utc(timeLog.startedAt), 'minutes');
            if (
                isEmpty(timeSlotsIds) &&
                logDifference > 10
            ) {
                await queryRunner.connection.manager.query(`
                    UPDATE "time_log" SET
                        "stoppedAt" = $1
                    WHERE
                        "id" IN($2)`,
                    [timeLog.startedAt, timeLog.id]
                );
            } else if (isNotEmpty(timeSlotsIds)) {
                const timeSlots = await queryRunner.connection.manager.query(`
                    SELECT * FROM
                        "time_slot"
                    WHERE
                        "time_slot"."id" IN ('${timeSlotsIds.join("','")}')
                    ORDER BY
                        "time_slot"."startedAt" DESC
                `);
                let stoppedAt: any;
                let slotDifference: any;

                const [lastTimeSlot] = timeSlots;
                const duration = timeSlots.reduce((sum: number, current: any) => sum + current.duration, 0);
                /**
                 * Adjust stopped date as per database selection
                 */
                stoppedAt = moment(lastTimeSlot.startedAt)
                    .add(duration, 'seconds')
                    .toDate();
                slotDifference = moment().diff(moment.utc(stoppedAt), 'minutes');
                if (slotDifference > 10) {
                    await queryRunner.connection.manager.query(`
                        UPDATE "time_log" SET
                            "stoppedAt" = $1
                        WHERE
                            "id" IN($2)`,
                        [stoppedAt, timeLog.id]
                    );
                }
            }
        }
    }

    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }
}
