import { FindOperator } from "typeorm";
import * as moment from "moment";
import { ITimerStatusInput, TimeLogSourceEnum } from "@gauzy/contracts";

//
interface TimeLogParams extends ITimerStatusInput {
    startedAt: FindOperator<Date>;
    stoppedAt: FindOperator<any>;
}

//
export interface TimeLogQueryParams extends ITimerStatusInput {
    where: {
        // Absent on the running-log query, which has no day window (see `buildRunningLogQueryParameters`).
        startedAt?: FindOperator<Date>;
        stoppedAt: FindOperator<any>;
        employeeId: string;
        tenantId: string;
        organizationId: string;
        isActive: boolean;
        isArchived: boolean;
        isRunning?: boolean;
        source?: TimeLogSourceEnum;
    }
    order: {
        startedAt: 'ASC' | 'DESC';
        createdAt: 'ASC' | 'DESC';
    }
}

/**
 * Constructs common query parameters for time log operations.
 *
 * @param params - Parameters used to construct query conditions.
 * @returns An object containing query parameters for database operations.
 */
export function buildCommonQueryParameters(params: TimeLogParams, includeJoin: boolean = false): TimeLogQueryParams {
    const { source, startedAt, stoppedAt, employeeId, tenantId, organizationId } = params;
    const queryParams: TimeLogQueryParams = {
        where: {
            ...(source ? { source } : {}),
            startedAt,
            stoppedAt,
            employeeId,
            tenantId,
            organizationId,
            isActive: true,
            isArchived: false
        },
        order: {
            startedAt: 'DESC', // Sorting by startedAt in descending order
            createdAt: 'DESC', // Sorting by createdAt in descending order
        }
    };

    // Adds a join clause to the query parameters if includeJoin is true.
    addJoinToQueryParams(queryParams, includeJoin);

    return queryParams;
}

/**
 * Adds a join clause to the query parameters if includeJoin is true.
 *
 * NOTE (typeorm-v1): the `join` find-option was removed in TypeORM 1.0 and is rejected by `find()`
 * at runtime. This `join` is consumed only by the MikroORM path (via `parseTypeORMFindToMikroOrm`);
 * the TypeORM path applies the equivalent inner join on the query builder instead (see
 * `TimerService` TypeORM branch). Do not pass the object produced here straight to a TypeORM `find()`.
 *
 * @param queryParams - The existing query parameters object to be modified.
 * @param includeJoin - A flag indicating whether to include the join clause.
 */
export function addJoinToQueryParams(queryParams: TimeLogQueryParams, includeJoin: boolean): TimeLogQueryParams {
    if (includeJoin) {
        queryParams['join'] = {
            alias: 'time_log',
            innerJoin: {
                timeSlots: 'time_log.timeSlots',
            }
        };
    }
    return queryParams;
}

/**
 * Builds log-specific query parameters.
 *
 * @param params - Parameters used to build query conditions.
 * @returns Query parameters tailored for log retrieval.
 */
export function buildLogQueryParameters(params: TimeLogParams): TimeLogQueryParams {
    const queryParams = buildCommonQueryParameters(params, true);
    queryParams.where.isRunning = false;
    return queryParams;
}

/**
 * Builds the query for the employee's running time log, whatever day it started on.
 *
 * It keeps every filter of `buildCommonQueryParameters` (source, employee, tenant, organization, active,
 * not archived, latest first) but drops the `startedAt` window: a timer started before the window (one
 * still running past midnight) is the log running now. With the window it was never found, so the timer
 * status read "stopped" until the timer was stopped.
 *
 * @param params - Parameters used to build query conditions; their `startedAt` window is not applied.
 * @returns Query parameters for the latest running time log.
 */
export function buildRunningLogQueryParameters(params: TimeLogParams): TimeLogQueryParams {
    const queryParams = buildCommonQueryParameters(params);
    delete queryParams.where.startedAt;
    queryParams.where.isRunning = true;
    return queryParams;
}

/**
 * Adds relations from the request to the query parameters.
 *
 * @param queryParams - The query parameters to modify.
 * @param request - The request object, potentially containing relations.
 */
export function addRelationsToQuery(queryParams: TimeLogQueryParams, request: ITimerStatusInput): void {
    if (request.relations) {
        queryParams.relations = request.relations;
    }
}

/**
 * The seconds of a time log that fall inside a window: the overlap of `[startedAt, stoppedAt]` with
 * `[windowStart, windowEnd]`, or 0 when they do not overlap. The timer status counts today's duration with it,
 * for completed logs and the running one alike, so a log that crosses midnight counts its part of the day only,
 * and the same part whether it is still running or already stopped.
 *
 * @param startedAt - When the log started.
 * @param stoppedAt - When it stopped (for the running log: now).
 * @param windowStart - The start of the window ("today" for the timer status).
 * @param windowEnd - The end of the window.
 * @returns The seconds of the log inside the window, never negative.
 */
export function secondsWithinWindow(
    startedAt: moment.MomentInput,
    stoppedAt: moment.MomentInput,
    windowStart: moment.Moment,
    windowEnd: moment.Moment
): number {
    if (!startedAt || !stoppedAt) {
        return 0;
    }
    const countedFrom = moment.max(moment.utc(startedAt), windowStart);
    const countedTo = moment.min(moment.utc(stoppedAt), windowEnd);
    return Math.max(0, countedTo.diff(countedFrom, 'seconds'));
}

/**
 * The exclusive end of a window given with an inclusive one, as every client sends `todayEnd`: `23:59:59.999`
 * (`endOf('day')`) or `23:59:59` (the same, formatted to the second). Both stand for "up to the next midnight", and
 * clipping a log at the inclusive end itself left the day's last second out (3,599 seconds for the 23:00–24:00 part
 * of a log), a second lost across the two days. The end's second is included whole: the window ends at the next
 * whole second.
 *
 * Only the duration arithmetic (`secondsWithinWindow`) takes this end; the queries keep the inclusive one, so a log
 * started at the next midnight stays out of the window.
 *
 * @param inclusiveEnd - The window's inclusive end.
 * @returns The first instant after the window.
 */
export function exclusiveWindowEnd(inclusiveEnd: moment.Moment): moment.Moment {
    return inclusiveEnd.clone().startOf('second').add(1, 'second');
}
