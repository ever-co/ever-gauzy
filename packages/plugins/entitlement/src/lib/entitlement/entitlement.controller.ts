import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ID, IPagination } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { Entitlement } from './entitlement.entity';
import { EntitlementKey } from '../entitlement-key/entitlement-key.entity';
import { EntitlementActivation } from '../entitlement-activation/entitlement-activation.entity';
import { EntitlementService } from './entitlement.service';
import { EntitlementKeyService } from '../entitlement-key/entitlement-key.service';
import { EntitlementActivationService } from '../entitlement-activation/entitlement-activation.service';
import { EntitlementCheckService } from '../entitlement-check/entitlement-check.service';
import { EntitlementFeatures } from '../entitlement.features';
import { EntitlementPermissions } from '../entitlement.permissions';
import { IEntitlementCheckResult, IEntitlementKeyIssueResult } from '../entitlement.types';
import { CreateEntitlementDTO, UpdateEntitlementDTO } from './dto';
import {
	ExtendEntitlementDTO,
	ReduceEntitlementDTO,
	RevokeEntitlementDTO,
	SuspendEntitlementDTO
} from './dto/entitlement-action.dto';
import { CheckEntitlementDTO } from './dto/entitlement-check.dto';
import { CreateEntitlementKeyDTO } from '../entitlement-key/dto';

/**
 * Entitlements.
 *
 * One surface, at `/entitlements`: reading what a customer holds, granting a right no order produced,
 * and the five transitions that bend or end one. The sub-resources a right owns — its activations and
 * its issued keys — are read and written through this controller too, because they are parts of the
 * right rather than concepts a caller arrives at on its own.
 *
 * Every route is behind the feature flag, which defaults to off: a tenant that does not sell rights
 * has the tables and none of the endpoints.
 *
 * The mutating routes adopt two conventions, and the GraphQL mutations that mirror them adopt both:
 *
 * - `@Idempotent({ scope: 'entitlement.<action>', required: false })` makes a route safe to retry under
 *   a key the client supplies. None of these routes demands one — an installation's existing callers
 *   send none — but a client that lost a response and presents one gets the first answer back instead
 *   of a second grant, a second suspension or a second withdrawal.
 * - `@Versioned({ resource: EntitlementService })` reads the version the caller states in `If-Match`,
 *   refuses a write based on a right that has moved on rather than overwriting the change that moved it,
 *   and publishes the version the response carries as its `ETag` — which is the header the next write
 *   states back. A right is created rather than edited by the grant route, so that route requires no
 *   version of its caller and simply publishes the one the created right carries.
 */
@ApiTags('Entitlement')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(EntitlementFeatures.ENTITLEMENT)
@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
@Controller('/entitlements')
export class EntitlementController extends CrudController<Entitlement> {
	constructor(
		private readonly entitlementService: EntitlementService,
		private readonly entitlementKeyService: EntitlementKeyService,
		private readonly entitlementActivationService: EntitlementActivationService,
		private readonly entitlementCheckService: EntitlementCheckService
	) {
		super(entitlementService);
	}

	/**
	 * Grants a right.
	 *
	 * A grant that names an order line or a subscription is idempotent on that provenance, so a
	 * retried request returns the right the first one created rather than a second one.
	 *
	 * No version is required of the caller: a right is created here rather than edited, so there is no
	 * row to have read. The version the created right carries is published in this response, which is
	 * where the write that follows reads the one it states.
	 *
	 * The retry scope is `entitlement.create`, and a key is not required: a client that presents one
	 * has its retry answered from the first attempt rather than granting a second right.
	 *
	 * @param entity The grant.
	 * @returns The right, and — when a key was issued — that key and its plaintext as extra members of
	 * the same body, returned once, here.
	 */
	@ApiOperation({ summary: 'Grant an entitlement' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The entitlement was granted.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The term or a condition is not usable.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@HttpCode(HttpStatus.CREATED)
	@Idempotent({ scope: 'entitlement.create', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService, required: false })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(
		@Body() entity: CreateEntitlementDTO
	): Promise<Entitlement & { key?: EntitlementKey; plaintextKey?: string; created: boolean }> {
		const result = await this.entitlementService.grant(entity as any);

		// The response is the right itself, with the one-time key material as additional members: a
		// caller that ignores them has the created resource, and the caller that asked for a key has
		// it exactly here and never again.
		return { ...result.entitlement, key: result.key, plaintextKey: result.plaintextKey, created: result.created };
	}

	/**
	 * Checks whether a right may be exercised.
	 *
	 * The route answers a question rather than performing an action, so a denial is a `200` with
	 * `allowed: false` and a stable code. It never answers not-found to hide a denial: a caller has to
	 * be able to tell "you may not" from "there is no such right".
	 *
	 * @param entity What the caller holds.
	 * @returns The verdict.
	 */
	@ApiOperation({ summary: 'Check an entitlement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The verdict, allowed or refused with a code.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The request is malformed.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@HttpCode(HttpStatus.OK)
	@Post('check')
	@UseValidationPipe({ transform: true, whitelist: true })
	async check(@Body() entity: CheckEntitlementDTO): Promise<IEntitlementCheckResult> {
		return await this.entitlementCheckService.check(entity);
	}

	/**
	 * Edits a right: its term, its ceiling, its activation limit, its extras and its conditions.
	 *
	 * The body is named as `UpdateEntitlementDTO` on the parameter itself rather than through a
	 * separate pipe target, because a request body is validated from the *type the handler names*: the
	 * inherited handler this route overrides declares the entity's own partial type as its parameter,
	 * whose reflected type is `Object`, which Nest's pipe cannot name a class for and therefore skips
	 * — an inherited update accepts any body at all and writes it. A body may not write the
	 * provenance, the number or the state: the service ignores those if a caller invents them.
	 *
	 * The edits are written under the version the caller read the right at, so two operators editing
	 * one right cannot silently overwrite each other: the second write is refused, and the caller
	 * re-reads before deciding again.
	 *
	 * @param id The right.
	 * @param entity The fields to change.
	 * @param request The request, which carries the version the caller read the right at.
	 * @returns The updated right.
	 */
	@ApiOperation({ summary: 'Update an entitlement' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The entitlement was updated.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Versioned({ resource: EntitlementService })
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateEntitlementDTO,
		@Req() request: Request
	): Promise<Entitlement> {
		const { conditions, ...changes } = entity;

		if (Object.keys(changes).length) {
			await this.entitlementService.applyChanges(id, changes as any, versionExpectationOf(request));
		}

		if (conditions) {
			await this.entitlementService.replaceConditions(id, conditions);
		}

		return await this.entitlementService.findOneDetailed(id);
	}

	/**
	 * Suspends a right temporarily.
	 *
	 * The retry scope is `entitlement.suspend`: a suspension a client repeats under one key is answered
	 * from the first attempt rather than performed again.
	 *
	 * @param id The right.
	 * @param entity Why.
	 * @param request The request, which carries the version the caller read the right at.
	 * @returns The suspended right.
	 */
	@ApiOperation({ summary: 'Suspend an entitlement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The entitlement was suspended.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Idempotent({ scope: 'entitlement.suspend', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService })
	@Post(':id/suspend')
	@UseValidationPipe({ transform: true, whitelist: true })
	async suspend(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: SuspendEntitlementDTO,
		@Req() request: Request
	): Promise<Entitlement> {
		return await this.entitlementService.suspend(id, entity.reason, {}, versionExpectationOf(request));
	}

	/**
	 * Returns a suspended right to force.
	 *
	 * The route takes no body: resuming clears the suspension reason that suspending recorded, and a
	 * note supplied here would only be a second, unreadable explanation of the same fact.
	 *
	 * The retry scope is `entitlement.resume`.
	 *
	 * @param id The right.
	 * @param request The request, which carries the version the caller read the right at.
	 * @returns The resumed right.
	 */
	@ApiOperation({ summary: 'Resume a suspended entitlement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The entitlement is in force again.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Idempotent({ scope: 'entitlement.resume', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService })
	@Post(':id/resume')
	async resume(@Param('id', UUIDValidationPipe) id: ID, @Req() request: Request): Promise<Entitlement> {
		return await this.entitlementService.resume(id, {}, versionExpectationOf(request));
	}

	/**
	 * Extends the term of a right, which is what a successful renewal does.
	 *
	 * The retry scope is `entitlement.extend`: an extension moves the right's own term, so a billing
	 * cycle replayed under one key must not move it twice.
	 *
	 * @param id The right.
	 * @param entity The new end of the term and the quantity that was billed.
	 * @param request The request, which carries the version the caller read the right at.
	 * @returns The extended right.
	 */
	@ApiOperation({ summary: 'Extend the term of an entitlement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The term was extended.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Idempotent({ scope: 'entitlement.extend', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService })
	@Post(':id/extend')
	@UseValidationPipe({ transform: true, whitelist: true })
	async extend(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ExtendEntitlementDTO,
		@Req() request: Request
	): Promise<Entitlement> {
		return await this.entitlementService.extend(
			id,
			{
				endsAt: entity.endsAt,
				quantity: entity.quantity,
				note: entity.note
			},
			{},
			versionExpectationOf(request)
		);
	}

	/**
	 * Lowers the ceiling a right carries, which is what a partial refund does.
	 *
	 * @param id The right.
	 * @param entity The ceiling that remains.
	 * @param request The request, which carries the version the caller read the right at.
	 * @returns The reduced right.
	 */
	@ApiOperation({ summary: 'Reduce the quantity of an entitlement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The quantity was reduced.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Versioned({ resource: EntitlementService })
	@Post(':id/reduce')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reduce(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReduceEntitlementDTO,
		@Req() request: Request
	): Promise<Entitlement> {
		return await this.entitlementService.reduce(id, entity.quantity, entity.reason, {}, versionExpectationOf(request));
	}

	/**
	 * Withdraws a right, terminally.
	 *
	 * The retry scope is `entitlement.revoke`: a withdrawal is terminal, so a client that repeats it
	 * under one key is answered from the first attempt rather than being told the right is gone.
	 *
	 * @param id The right.
	 * @param entity Why.
	 * @param request The request, which carries the version the caller read the right at.
	 * @returns The withdrawn right.
	 */
	@ApiOperation({ summary: 'Revoke an entitlement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The entitlement was revoked.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Idempotent({ scope: 'entitlement.revoke', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService })
	@Post(':id/revoke')
	@UseValidationPipe({ transform: true, whitelist: true })
	async revoke(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: RevokeEntitlementDTO,
		@Req() request: Request
	): Promise<Entitlement> {
		return await this.entitlementService.revoke(id, entity.reason, {}, versionExpectationOf(request));
	}

	/**
	 * Reads a right with its activations, its keys and the party it was granted to.
	 *
	 * @param id The right.
	 * @returns The right.
	 */
	@ApiOperation({ summary: 'Find an entitlement with its activations and keys' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The entitlement was found.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<Entitlement> {
		return await this.entitlementService.findOneDetailed(id);
	}

	/**
	 * Lists rights.
	 *
	 * @param options The filter, including `filter[status]`, `filter[customerId]` and `filter[kind]`.
	 * @returns The rights, paginated.
	 */
	@ApiOperation({ summary: 'List entitlements' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The entitlements were listed.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<Entitlement>): Promise<IPagination<Entitlement>> {
		return await this.entitlementService.findAll(options);
	}

	/**
	 * The devices, instances and named seats occupying a right's slots.
	 *
	 * @param id The right.
	 * @returns Its activations.
	 */
	@ApiOperation({ summary: 'List the activations of an entitlement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The activations were listed.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Get(':id/activations')
	async activations(@Param('id', UUIDValidationPipe) id: ID): Promise<EntitlementActivation[]> {
		await this.entitlementService.findOneScoped(id);

		return await this.entitlementActivationService.findForEntitlement(id);
	}

	/**
	 * The credentials issued against a right. The digest and the ciphertext never appear here.
	 *
	 * @param id The right.
	 * @returns Its keys.
	 */
	@ApiOperation({ summary: 'List the licence keys of an entitlement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The keys were listed.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Get(':id/keys')
	async keys(@Param('id', UUIDValidationPipe) id: ID): Promise<EntitlementKey[]> {
		await this.entitlementService.findOneScoped(id);

		return await this.entitlementKeyService.findForEntitlement(id);
	}

	/**
	 * Issues a licence key against a right.
	 *
	 * The route writes a credential rather than the right: the key row is created against the right and
	 * the right's own revision does not move, so the route states no version of its caller and is
	 * answered from the right's state alone. The right is read, not written — a credential is only
	 * issued against a right that is `PENDING` or `ACTIVE`.
	 *
	 * The retry scope is `entitlement_key.issue`, which the GraphQL mutation that issues the same
	 * credential declares as well: a client that lost the response to one gets the same key row back
	 * rather than a second credential. The two reach the operation differently — the right comes from
	 * the path here and from the input there — and their fingerprints differ with it, so a retry of one
	 * can never replay the other's answer.
	 *
	 * @param id The right.
	 * @param entity The format, the holder and whether the key should be recoverable.
	 * @returns The key and its plaintext, which is returned once and never again.
	 */
	@ApiOperation({ summary: 'Issue a licence key for an entitlement' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The key was issued.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The right cannot carry a key.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@HttpCode(HttpStatus.CREATED)
	@Idempotent({ scope: 'entitlement_key.issue', required: false, resourceType: 'entitlement_key' })
	@Post(':id/keys')
	@UseValidationPipe({ transform: true, whitelist: true })
	async issueKey(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: CreateEntitlementKeyDTO
	): Promise<IEntitlementKeyIssueResult> {
		return await this.entitlementKeyService.issue({ ...entity, entitlementId: id });
	}
}
