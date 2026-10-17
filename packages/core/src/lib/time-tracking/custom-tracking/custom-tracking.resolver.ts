/**
 * The metadata store is loaded before this module is evaluated, because the permission below is read from
 * the controller's own decorator metadata at class-definition time rather than retyped here. The
 * application does that at bootstrap; a module that reads metadata while it is being defined is a module
 * that must not depend on the order a bootstrap happens to load things in.
 */
import 'reflect-metadata';

import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ID as Id, ITrackingSessionResponse, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../../shared/decorators';
import {
	FeatureFlagGuard,
	PermissionGuard,
	TenantPermissionGuard
} from '../../shared/guards';
// Imported from its own module rather than through the `shared/guards` barrel, and the difference matters:
// `@UseGuards(...)` is evaluated when this class is defined, the barrel reaches `core/index.ts`, which reaches
// `core.module` and every domain module — so in some load orders the guard comes back `undefined` and Nest
// refuses the decorator with `Invalid guard passed to @UseGuards()`, taking the whole suite down with it.
import { EmployeeTrackedDataGuard } from '../../shared/guards/employee-tracked-data.guard';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { CustomTrackingController } from './custom-tracking.controller';
import { CustomTrackingService } from './custom-tracking.service';
import { CustomTrackingSessionsQueryDTO, ProcessTrackingDataDTO } from './dto';

/** The members `CustomTrackingSubmissionInput` declares in the schema. */
export interface ICustomTrackingSubmissionInput {
	readonly organizationId: Id;
	readonly payload: string;
	readonly startTime: Date;
	readonly employeeId?: Id;
}

/** The members `CustomTrackingBulkInput` declares in the schema. */
export interface ICustomTrackingBulkInput {
	readonly list: ICustomTrackingSubmissionInput[];
}

/**
 * The narrowing the sessions read takes.
 *
 * It is the delivered query DTO's own member set, minus the members the delivered read never consults: the
 * source, log-kind, task and team selectors and the relation list are declared by the DTO because every
 * time-tracking query shares one shape, and none of them reaches the reader that answers this field. An
 * argument whose value the read discards is worse than an argument that is absent, so they are absent.
 */
export interface ICustomTrackingSessionsQueryInput {
	readonly organizationId: Id;
	readonly startDate?: Date;
	readonly endDate?: Date;
	readonly employeeIds?: Id[];
	readonly projectIds?: Id[];
	readonly sessionId?: string;
	readonly groupBySession?: boolean;
	readonly includeDecodedData?: boolean;
}

/**
 * The permission every route of this controller runs under.
 *
 * Read from the controller's own metadata rather than retyped: none of its handlers states a permission of
 * its own, so the class-level list is what the guard resolves for all six routes — and reading it here is
 * what makes a change to the controller's declaration reach this surface instead of leaving GraphQL a
 * scope REST no longer has, or the reverse.
 */
const CUSTOM_TRACKING_PERMISSIONS = (Reflect.getMetadata(PERMISSIONS_METADATA, CustomTrackingController) ??
	[]) as PermissionsEnum[];

/**
 * The window the delivered route reads when a caller states none, in minutes.
 *
 * Named rather than inlined because the SDL states the same number in its own description: a default
 * written twice is a default that drifts, and the one a caller reads about is the one that has to be
 * applied.
 */
const DEFAULT_ACTIVITY_THRESHOLD_MINUTES = 30;

/**
 * Custom tracking over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `CustomTrackingService` method the `/timesheet/custom-tracking`
 * routes call, with the same arguments.
 *
 * **The guard chain and the permission are the controller's.** The class carries the same two guards the
 * controller carries, in the same order, plus the gate; every field states the permission the controller's
 * own metadata states, which for this controller is its class-level triple, because no handler of it
 * overrides that.
 *
 * **The tracked-data guard is the route's as well, and it is per route on both surfaces.** The four read
 * routes state `EmployeeTrackedDataGuard`, which applies the organization's `allowEmployeeToSeeTrackedData`
 * setting: a tracking session is who was tracked, when, and on what — screenshots, app usage and URL
 * history — and that is the organization's to withhold from its own employees. The four reads below state
 * the same guard, because a field that answered one without it would serve over this protocol a read the
 * REST route refuses, which for tracked data is a privacy defect rather than a cosmetic mismatch. The two
 * writes mirror the two routes that carry no such guard, and they carry none here either: recording is
 * what produces tracked data, so gating it would stop the tracker rather than protect anyone.
 * `EmployeeTrackedDataGuard` injects only the global `DataSource`, which `TypeOrmCoreModule` exports to
 * every module, so this module can construct it as it constructs the three guards above.
 *
 * **Every read here is a computed answer rather than a resource list**, which is why there is no connection
 * on this surface: a session is recovered by decoding the documents the writes stored, and the rows that
 * are stored belong to the slot domain. The module comment in `custom-tracking.api.gql` states the
 * reasoning for all four reads.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class, which is
 * why the gate is stated on the class rather than restated on each field — and why it is appended to the
 * guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('CustomTracking')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(...CUSTOM_TRACKING_PERMISSIONS)
export class CustomTrackingResolver {
	constructor(private readonly customTrackingService: CustomTrackingService) {}

	/**
	 * Submits one encoded tracking payload.
	 *
	 * The same service method the submit route calls, with the same body. The instant the payload belongs to
	 * is stated by the caller and validated by that method, which refuses an unreadable one — which is why
	 * the schema states it as required rather than leaving the refusal to a runtime check a client cannot
	 * see.
	 */
	@Mutation('submitTrackingData')
	@Permissions(...CUSTOM_TRACKING_PERMISSIONS)
	async submitTrackingData(@Args('input') input: ICustomTrackingSubmissionInput) {
		return await this.customTrackingService.submitTrackingData(input as unknown as ProcessTrackingDataDTO);
	}

	/**
	 * Submits several encoded tracking payloads in one call.
	 *
	 * The same service method the bulk route calls, with the same argument: the route binds a body whose one
	 * member is the list, and hands that member over — so a payload that fails is answered inside the
	 * result rather than failing the call.
	 */
	@Mutation('submitBulkTrackingData')
	@Permissions(...CUSTOM_TRACKING_PERMISSIONS)
	async submitBulkTrackingData(@Args('input') input: ICustomTrackingBulkInput) {
		return await this.customTrackingService.submitBulkTrackingData(
			input.list as unknown as ProcessTrackingDataDTO[]
		);
	}

	/**
	 * The sessions recovered from the tracking payloads of one organization.
	 *
	 * The same service method the sessions route calls, with the same query. The two flags are stated with
	 * the delivered query DTO's own defaults rather than left undefined: an absent flag means "fold the
	 * sessions" and "carry the encoded form only" on the route, because the DTO declares those defaults, and
	 * a flag that meant the opposite here would make the two surfaces answer different rows for the same
	 * question.
	 */
	@Query('trackingSessions')
	@Permissions(...CUSTOM_TRACKING_PERMISSIONS)
	@UseGuards(EmployeeTrackedDataGuard)
	async trackingSessions(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('sessionId', { type: () => String, nullable: true }) sessionId?: string,
		@Args('groupBySession', { type: () => Boolean, nullable: true }) groupBySession?: boolean,
		@Args('includeDecodedData', { type: () => Boolean, nullable: true }) includeDecodedData?: boolean
	) {
		const query = {
			organizationId,
			startDate,
			endDate,
			employeeIds,
			projectIds,
			sessionId,
			groupBySession: groupBySession ?? true,
			includeDecodedData: includeDecodedData ?? false
		} as unknown as CustomTrackingSessionsQueryDTO;

		return await this.customTrackingService.getTrackingSessions(query);
	}

	/**
	 * One slot's tracking data.
	 *
	 * The same service method the slot route calls, with the same identifier. The delivered method answers
	 * a slot that holds no tracking with `hasTrackingData: false` and refuses a slot that is not there with
	 * a miss; a miss is `null` here rather than a refusal, because GraphQL has one answer for "no such row"
	 * on a field that may have none and the route's `404` is that same fact in the other protocol's
	 * vocabulary.
	 */
	@Query('timeSlotTrackingData')
	@Permissions(...CUSTOM_TRACKING_PERMISSIONS)
	@UseGuards(EmployeeTrackedDataGuard)
	async timeSlotTrackingData(@Args('timeSlotId', { type: () => ID }) timeSlotId: Id) {
		try {
			return await this.customTrackingService.getTimeSlotTrackingData(timeSlotId);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The sessions one session identifier belongs to, over an optional range.
	 *
	 * The same service method the identifier route calls, with the same argument list — including the two
	 * the route leaves unstated. The route passes `undefined` for the tenant and the organization because
	 * the method reads both from the credential when they are absent, and this field passes the same two
	 * absences rather than inventing values for them: the scope of a read is the credential's, never a
	 * caller's to state.
	 */
	@Query('trackingSessionsBySessionId')
	@Permissions(...CUSTOM_TRACKING_PERMISSIONS)
	@UseGuards(EmployeeTrackedDataGuard)
	async trackingSessionsBySessionId(
		@Args('sessionId', { type: () => String }) sessionId: string,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date
	): Promise<ITrackingSessionResponse[]> {
		return await this.customTrackingService.getSessionsBySessionId(
			sessionId,
			undefined,
			undefined,
			startDate,
			endDate
		);
	}

	/**
	 * The sessions a tracker is reporting right now.
	 *
	 * The same service method the active route calls, with the same two arguments — the threshold included.
	 * The route reads a default of thirty minutes and hands the method the larger of that value and one, so
	 * a caller that states nothing, zero or a negative number is answered a thirty-minute window, a
	 * one-minute window and a one-minute window respectively; this field applies the same floor rather than
	 * passing a value the route would have clamped, because a window that ended in the past is not an
	 * answer any caller asked for.
	 */
	@Query('activeTrackingSessions')
	@Permissions(...CUSTOM_TRACKING_PERMISSIONS)
	@UseGuards(EmployeeTrackedDataGuard)
	async activeTrackingSessions(
		@Args('employeeId', { type: () => ID, nullable: true }) employeeId?: Id,
		@Args('activityThresholdMinutes', { type: () => Int, nullable: true }) activityThresholdMinutes?: number
	): Promise<ITrackingSessionResponse[]> {
		return await this.customTrackingService.getActiveSessions(
			employeeId,
			Math.max(1, activityThresholdMinutes ?? DEFAULT_ACTIVITY_THRESHOLD_MINUTES)
		);
	}
}
