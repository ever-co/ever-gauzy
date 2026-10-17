import { UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	ITimeLog,
	ITimerStatus,
	ITimerStatusInput,
	ITimerToggleInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { TimerService } from './timer.service';
import { StartTimerCommand, StopTimerCommand } from './commands';
import { GetTimerStatusQuery } from './queries';

/**
 * The timer's current state, as `TimerStatus` declares it.
 *
 * A local interface rather than the contracts one, so the shape this resolver hands to the schema and
 * the shape the schema declares are stated in one place — the same reason the employee-statistics
 * resolver states its own.
 *
 * `lastLog` is carried as the identifier of the log the state was computed from and not as the row.
 * That is the difference between a state and a write: a write answers the log it touched, and this
 * surface answers that row — see the three mutations below — while a state is a computation over logs
 * and names the one it was derived from. The delivered status read also joins none of that log's
 * relations — the route's own `relations` member is its query-string vocabulary and this surface offers
 * none — so a nested type here would carry an entity whose relations are always absent.
 */
export interface ITimerCurrentStatus {
	duration: number;
	running: boolean;
	lastLogId: Id | null;
}

/**
 * One employee's worked state, as `TimerWorkedStatus` declares it.
 *
 * `employeeId` and `lastLogId` are never absent on this answer: the delivered read selects the last
 * log of each employee it considered and requires that log to have both ends, so the row behind the
 * state always exists. `employeeId` is read off that log's own column, which is the only member of the
 * delivered answer that names the employee the state belongs to — without it the list would be a set
 * of states with nothing to attribute them to.
 */
export interface ITimerWorkedStatus {
	employeeId: Id;
	duration: number;
	running: boolean;
	timerStatus: ITimerStatus['timerStatus'];
	lastLogId: Id;
}

/**
 * The timer over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `TimerService` method, dispatches the same command or
 * the same query, that the `/api/timesheet/timer` routes reach.
 *
 * **Two of the five fields are computed answers, and they are root fields of their own because there
 * is no resource for them to hang off.** A timer's status is not a row: it has no identifier of its
 * own, nothing to withdraw and nothing to state, and what it answers is a computation over the time
 * logs of a period. So this surface declares no connection, no node query and no count — the
 * controller serves no list, no `GET /:id` and no `GET /count` for any of them to mirror — and the
 * two reads below answer the states themselves, each documented as the computation it is.
 *
 * **The guard chain and the class permission are the controller's.** The class carries
 * `TenantPermissionGuard` and `PermissionGuard` with `TIME_TRACKER`, which is what
 * `TimerController` carries, and every field then states the permission its own route runs under: the
 * two status routes declare `ALL_ORG_VIEW` beside the class permission, and the three write routes
 * declare none of their own and therefore run under the class one.
 *
 * **Neither read takes a `relations` argument, and that is a statement rather than an omission.** The
 * delivered status routes read a `relations` member out of their query string and hand it to the
 * status read, which loads the named relations onto the log it answers with. This surface carries that
 * log as its identifier — see `ITimerCurrentStatus` — so a `relations` argument would name rows no
 * member of the answer could carry: an argument whose effect is invisible is worse than an absent one.
 *
 * **The gate is the commerce catalogue's**: `FEATURE_GRAPHQL` is the code the catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Timer')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.TIME_TRACKER)
export class TimerResolver {
	constructor(
		private readonly timerService: TimerService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * The caller's timer as it stands today.
	 *
	 * The same query the delivered `GET /status` route dispatches, with the same input: the query DTO
	 * that route binds from its query string, built here from this field's own arguments. Every member
	 * the delivered read consults is an argument, and nothing the read would ignore is offered:
	 *
	 * - the organization and the source narrow the logs the status is computed over, and the source is
	 *   optional exactly as the route's own validation states it;
	 * - `todayStart` and `todayEnd` are the ends of the period the computation is anchored to, and an
	 *   absent one is the same statement here that it is there — the delivered read then takes the
	 *   start or the end of the current day;
	 * - `employeeId` is the employee whose status is read, and the delivered read consults it only for
	 *   a caller that may change the selected employee — which is not restated here, because a second
	 *   copy of that rule is the copy that drifts.
	 *
	 * The route's DTO also declares `employeeIds`, and it is deliberately not an argument: the single
	 * status read never consults it, so a caller stating one would be handed the same answer as a
	 * caller stating nothing.
	 */
	@Query('timerStatus')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_TRACKER)
	async timerStatus(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('source', { type: () => String, nullable: true }) source?: string,
		@Args('todayStart', { type: () => Date, nullable: true }) todayStart?: Date,
		@Args('todayEnd', { type: () => Date, nullable: true }) todayEnd?: Date,
		@Args('employeeId', { type: () => ID, nullable: true }) employeeId?: Id
	): Promise<ITimerCurrentStatus> {
		const status: ITimerStatus = await this.queryBus.execute(
			new GetTimerStatusQuery({
				organizationId,
				source,
				todayStart,
				todayEnd,
				employeeId
			} as unknown as ITimerStatusInput)
		);

		return {
			duration: status.duration ?? 0,
			running: status.running ?? false,
			lastLogId: status.lastLog?.id ?? null
		};
	}

	/**
	 * The last worked state of each employee the read considered.
	 *
	 * The same service method the delivered `GET /status/worked` route calls, with the same input that
	 * route binds from its query string. The reads are one per employee and the narrowing is therefore
	 * a set of employees: `employeeIds` is the route's own member for it, and `employeeId` is the
	 * single-employee spelling the delivered read falls back to when no set is stated.
	 *
	 * Three members of the route's query string are deliberately not arguments, each for its own
	 * reason. `todayStart` and `todayEnd` are not, because this read consults neither — it takes the
	 * last log of each employee whatever day it belongs to. `organizationTeamId` is not, because the
	 * route's own validation does not admit it: the DTO the route binds declares no such member, so a
	 * REST caller cannot state it either, and offering it here would be a narrower or a wider surface
	 * than the route — depending on the day, a different one.
	 */
	@Query('timerWorkedStatus')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_TRACKER)
	async timerWorkedStatus(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('source', { type: () => String, nullable: true }) source?: string,
		@Args('employeeId', { type: () => ID, nullable: true }) employeeId?: Id,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[]
	): Promise<ITimerWorkedStatus[]> {
		const statuses: ITimerStatus[] = await this.timerService.getTimerWorkedStatus({
			organizationId,
			source,
			employeeId,
			employeeIds
		} as unknown as ITimerStatusInput);

		return (statuses ?? []).map((status) => ({
			employeeId: status.lastLog?.employeeId,
			duration: status.duration ?? 0,
			running: status.running ?? false,
			timerStatus: status.timerStatus,
			lastLogId: status.lastLog?.id
		}));
	}

	/**
	 * Starts the timer when none is running and stops it when one is.
	 *
	 * The same service method the delivered `POST /toggle` route calls, with the same body: the route
	 * hands the input it validated straight to the service, which then decides which of the two writes
	 * to perform, so the decision is not restated here — a second copy of it would be the copy that
	 * drifts. The answer is the service's own, unprojected: the route answers the log the write touched,
	 * and so does this field.
	 *
	 * **The answer is nullable, and the evidence for that is the stop side's own last statement.** A
	 * toggle that stops the timer ends where the stop write ends — a `findOneBy` re-read of the row it
	 * just wrote, which answers nothing at all when it cannot find it — and the route states the same
	 * possibility, declaring its answer as the log *or null*. Claiming a non-null row here would be a
	 * claim this write can violate.
	 */
	@Mutation('toggleTimer')
	@Permissions(PermissionsEnum.TIME_TRACKER)
	async toggleTimer(@Args('input') input: ITimerToggleInput): Promise<ITimeLog | null> {
		return await this.timerService.toggleTimeLog(input);
	}

	/**
	 * Starts the timer.
	 *
	 * The write is dispatched as the same command the delivered `POST /start` route dispatches, with
	 * the same body, and it answers the same thing the route answers: the log the handler created,
	 * unprojected.
	 *
	 * **The answer is a row and never nothing, which is what makes the non-null claim safe.** The
	 * handler ends by reading back the row it just wrote through `findOneByIdString`, and that reader
	 * raises on a miss rather than answering nothing — so the two possible outcomes of this write are a
	 * row and a raised refusal, and a client that receives an answer has a log in its hands.
	 */
	@Mutation('startTimer')
	@Permissions(PermissionsEnum.TIME_TRACKER)
	async startTimer(@Args('input') input: ITimerToggleInput): Promise<ITimeLog> {
		return await this.commandBus.execute(new StartTimerCommand(input));
	}

	/**
	 * Stops the timer.
	 *
	 * The write is dispatched as the same command the delivered `POST /stop` route dispatches, with
	 * the same body, and it answers the command's own answer: the log it stopped, unprojected.
	 *
	 * **The answer is nullable for the same reason the toggle's is, and the route says so too.** The
	 * handler's last statement re-reads the row it wrote with a `findOneBy`, which answers nothing when
	 * the row is not there, and the route declares its own answer as the log *or null*.
	 *
	 * The handler also refuses a caller whose timer is already stopped, and that refusal is not
	 * restated here: it is the delivered statement of the condition, and this surface answers it in the
	 * other protocol's vocabulary by letting it travel.
	 */
	@Mutation('stopTimer')
	@Permissions(PermissionsEnum.TIME_TRACKER)
	async stopTimer(@Args('input') input: ITimerToggleInput): Promise<ITimeLog | null> {
		return await this.commandBus.execute(new StopTimerCommand(input));
	}
}
