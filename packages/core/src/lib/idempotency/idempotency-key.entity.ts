import { ExportRedacted } from '../export-import/export-redact.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IIdempotencyKey, IdempotencyStatus, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmIdempotencyKeyRepository } from './repository/mikro-orm-idempotency-key.repository';

/**
 * A stored idempotency key.
 *
 * The row is the lock. Two concurrent identical requests cannot both insert the unique tuple
 * `(tenantId, organizationId, scope, key)`, so the loser of the race learns that the work is already
 * in flight rather than repeating it; a row that holds a terminal response is replayed verbatim
 * without the work running again.
 *
 * **The tuple is not literally those four columns, and the difference is load-bearing.** `tenantId`
 * and `organizationId` are nullable, and every dialect the platform supports treats nulls in a unique
 * index as distinct from one another — spelled that way the index would constrain nothing for a
 * caller with no organization selected, which is every service account, every integration and every
 * token issued without `lastOrganizationId`. The index (`UQ_idempotency_tenant_org_scope_key`)
 * therefore folds both columns to the zero uuid before indexing them, over the live rows only; MySQL,
 * which has neither expression nor filtered indexes, carries the folded values and the soft-delete
 * predicate in stored generated columns. The tenant is part of it because the lookup that finds a
 * key is scoped by tenant: the index without it let one tenant's key refuse another tenant's
 * request — see `ScopeIdempotencyKeyByTenant1791000000557`.
 */
@MultiORMEntity('idempotency_key', { mikroOrmRepository: () => MikroOrmIdempotencyKeyRepository })
export class IdempotencyKey extends TenantOrganizationBaseEntity implements IIdempotencyKey {
	/**
	 * The client-supplied value, taken from the request header.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 255 })
	key: string;

	/**
	 * Operation namespace, for example `checkout.complete`.
	 *
	 * Two operations may reuse one client key, so the namespace is part of the identity rather than
	 * a filter applied after the lookup.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	scope: string;

	/**
	 * SHA-256 of the canonicalised request body.
	 *
	 * A replay with a different body is a conflict rather than a replay, and this is what makes the
	 * two distinguishable without storing the body itself.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	// a digest of a request body
	@ExportRedacted({ blank: true })
	@MultiORMColumn({ type: 'varchar', length: 64 })
	requestHash: string;

	/**
	 * Where the attempt stands.
	 */
	@ApiProperty({ type: () => String, enum: IdempotencyStatus })
	@IsEnum(IdempotencyStatus)
	@MultiORMColumn({ type: 'varchar', default: IdempotencyStatus.IN_PROGRESS })
	status: IdempotencyStatus;

	/**
	 * HTTP status of the stored response, replayed as-is.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', nullable: true })
	responseStatus?: number;

	/**
	 * The stored response body, replayed verbatim.
	 *
	 * Stored as JSON rather than a serialised string so an operator can read it with a query, and
	 * replayed without a second serialisation that could change the bytes the client first saw.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	responseBody?: JsonData;

	/**
	 * What was created, for example `order`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	resourceType?: string;

	/**
	 * Id of the created resource.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	resourceId?: ID;

	/**
	 * Retention horizon; the cleanup job deletes expired rows.
	 */
	@ApiProperty({ type: () => Date })
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ })
	expiresAt: Date;

	/**
	 * When the in-progress lock was taken.
	 *
	 * A lock older than the operation deadline can be taken over, which is what stops a request
	 * whose process died mid-flight from holding its key forever.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	lockedAt?: Date;
}
