import { FindOperator } from "typeorm";
import { ITimerStatusInput, TimeLogSourceEnum } from "@gauzy/contracts";

//
interface TimeLogParams extends ITimerStatusInput {
    startedAt: FindOperator<Date>;
    stoppedAt: FindOperator<any>;
}

//
interface TimeLogQueryParams extends ITimerStatusInput {
    where: {
        startedAt: FindOperator<Date>;
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
 * Currently we will allow to get the running log entry to get the partial
 * saved time to be reflected in timer status
 *
 * @param params - Parameters used to build query conditions.
 * @returns Query parameters tailored for log retrieval.
 */
export function buildLogQueryParameters(params: TimeLogParams): TimeLogQueryParams {
    const queryParams = buildCommonQueryParameters(params, true);
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
