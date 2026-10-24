import { Injectable, BadRequestException, HttpStatus, HttpException } from '@nestjs/common';
import { Brackets, DeleteResult, FindOptionsWhere, WhereExpressionBuilder } from 'typeorm';
import {
	ID,
	IEquipmentSharing,
	IEquipmentSharingCreateInput,
	IEquipmentSharingUpdateInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { ConfigService, DatabaseTypeEnum } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/utils';
import { prepareSQLQuery as p } from './../database/database.helper';
import { EquipmentSharing } from './equipment-sharing.entity';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { isWithinOrganizationBoundary } from '../core/crud/organization-boundary';
import { MultiORMEnum, parseSortOrder } from '../core/utils';
import { TypeOrmEquipmentSharingRepository } from './repository/type-orm-equipment-sharing.repository';
import { MikroOrmEquipmentSharingRepository } from './repository/mikro-orm-equipment-sharing.repository';
import { TypeOrmRequestApprovalRepository } from './../request-approval/repository/type-orm-request-approval.repository';
import { bumpVersion, parseEntityVersion } from '../concurrency/version.util';
import { ApiException } from '../core/errors/api-exception';
import {
	assertReferencesAreInScope,
	IReferenceScope,
	ISharingColumns,
	ISharingReferences,
	IStoredSharing,
	sharingAsStored,
	sharingReferences,
	withReferencesAsIds
} from './reference-scope.helper';
import { affectedRows, expectedSharingVersion, sharingVersionConflict } from './sharing-version.helper';

/** The stored sharing a `POST /equipment-sharing` body id names, as the upsert's check reads it. */
interface IStoredSharingRow extends IStoredSharing {
	id: ID;
	version?: number | null;
}

/**
 * Columns the equipment sharing table can be sorted by. Any other `order` key from the query string is ignored.
 */
const SORTABLE_COLUMNS = ['shareRequestDay', 'shareStartDay', 'shareEndDay'] as const;

@Injectable()
export class EquipmentSharingService extends TenantAwareCrudService<EquipmentSharing> {
	constructor(
		typeOrmEquipmentSharingRepository: TypeOrmEquipmentSharingRepository,
		mikroOrmEquipmentSharingRepository: MikroOrmEquipmentSharingRepository,
		readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,
		readonly configService: ConfigService
	) {
		super(typeOrmEquipmentSharingRepository, mikroOrmEquipmentSharingRepository);
	}

	/**
	 * Refuses a referenced Equipment / EquipmentSharingPolicy that is not in the caller's scope.
	 *
	 * The update path is a delete-then-recreate that spreads the request body, so a body-supplied
	 * `equipmentId` or `equipmentSharingPolicyId` is persisted as-is. Pinning the row's own
	 * organization does not help: nothing validated what it POINTS AT, so an update could re-attach a
	 * sharing to another organization's equipment. The foreign key only proves the row exists.
	 *
	 * Both targets extend TenantOrganizationBaseEntity, so both are scopeable.
	 *
	 * Each target is checked in both forms the body can name it, the column (`equipmentSharingPolicyId`) and the
	 * related object (`equipmentSharingPolicy: { id }`), which the ORM persists as the foreign key just the same —
	 * see `sharingReferences`.
	 *
	 * @param input - The update/create payload.
	 * @param scope - The tenant/organization the record belongs to.
	 * @throws ForbiddenException when a referenced row is outside the scope.
	 */
	public async assertReferencesAreInScope(
		input: Partial<IEquipmentSharingUpdateInput> | ISharingReferences,
		scope: IReferenceScope
	): Promise<void> {
		await assertReferencesAreInScope(sharingReferences(input), scope, (table, where) =>
			this.typeOrmRepository.manager.findOne(table, { where: where as any })
		);
	}

	/**
	 * Refuses a `POST /equipment-sharing` payload whose equipment or policy is not a row of the organization the
	 * sharing is stored in, and answers the payload to store.
	 *
	 * The payload is read as the row it will store ({@link sharingAsStored}): the organization in either form the body
	 * names it, and — the CRUD base's `create()` being an upsert by id — the organization and the references of the
	 * stored row a body-supplied id names, where the body states none. The payload answered states the organization,
	 * the equipment and the policy exactly as they were checked, each as its column, so the upsert keeps none of the
	 * stored row's: the row is stored where, and with what, it was checked, even when another write changed the
	 * stored row in the meantime.
	 *
	 * @param input - The raw request body.
	 * @returns The payload to hand to `create()`.
	 * @throws BadRequestException when the body's id is not a string.
	 * @throws ForbiddenException when a referenced row is outside the organization the sharing is stored in.
	 */
	public async assertCreateIsInScope(
		input: ISharingReferences & { id?: unknown }
	): Promise<ISharingColumns & { id?: unknown }> {
		return (await this.checkCreate(input)).payload;
	}

	/**
	 * Stores a `POST /equipment-sharing` payload once {@link assertCreateIsInScope} has checked it, through `create`
	 * (the CRUD base's upsert, which the controller hands in).
	 *
	 * A body whose id names a stored sharing is an edit of that sharing, and two of them used to interleave column by
	 * column: the upsert's `save()` writes only the columns that differ from what it loads, so an edit checked in one
	 * organization could land after another edit moved the sharing and keep half of each (review on
	 * ever-co/ever-gauzy#11359). Such an upsert first claims the version of the row the check read — or the version
	 * the body states — in one conditional statement, `UPDATE … SET version = :next WHERE id = :id AND version =
	 * :read`, and is refused with 409 when the row has moved on; the upsert then stores the checked payload. Of two
	 * edits based on the same read, one claims the version and the other is refused before it writes anything.
	 *
	 * The claim and the upsert are two statements, so an edit that reads the row between another's claim and its write
	 * reads the claimed version with the columns from before that write; closing that window needs the upsert itself
	 * to be predicated, which the CRUD base's `save()` cannot be. `PUT /equipment-sharing/:id`, the edit the UI makes,
	 * has no such window (see `EquipmentSharingUpdateHandler`).
	 *
	 * The body's `version` is a precondition, never a column the upsert writes: a new row starts at 1, and a stored
	 * row's version is moved on by the claim and by the upsert's own write.
	 *
	 * @param input - The raw request body.
	 * @param create - Persists the checked payload.
	 * @returns What `create` answers.
	 * @throws ForbiddenException when a referenced row is outside the organization the sharing is stored in.
	 * @throws ApiException 409 `ENTITY_VERSION_CONFLICT` when the stored sharing moved on; 400 for a malformed version.
	 */
	public async storeCreate<R>(
		input: ISharingReferences & { id?: unknown; version?: unknown },
		create: (payload: ISharingColumns & { id?: unknown }) => Promise<R>
	): Promise<R> {
		const { payload, stored } = await this.checkCreate(input);

		// A stored row outside the caller's organization boundary is not claimed: the upsert refuses it (403), as it
		// always has, and a claim first would have answered that refusal as a conflict.
		if (stored && isWithinOrganizationBoundary(stored.organizationId)) {
			const expected = expectedSharingVersion(input?.version, stored.version);
			if (expected !== null) {
				await this.updateAtVersion(stored.id, expected, { version: bumpVersion(expected) });
			}
		}

		return await create(payload);
	}

	/**
	 * The check of a `POST /equipment-sharing` body: see {@link assertCreateIsInScope}.
	 *
	 * @param input - The raw request body.
	 * @returns The payload to persist (without the body's `version`, a precondition rather than a column), and the
	 * stored sharing the body's id names, as it was read for the check.
	 */
	private async checkCreate(
		input: ISharingReferences & { id?: unknown; version?: unknown }
	): Promise<{ payload: ISharingColumns & { id?: unknown }; stored: IStoredSharingRow | null }> {
		const tenantId = RequestContext.currentTenantId();
		const { version: _version, ...body } = (input ?? {}) as ISharingReferences & {
			id?: unknown;
			version?: unknown;
		};
		const values: ISharingColumns & { id?: unknown } = withReferencesAsIds(body);
		const stored = await this.findStoredSharing(values.id, tenantId);
		const {
			values: payload,
			references,
			organizationId
		} = sharingAsStored(values, stored, RequestContext.currentOrganizationId());

		await this.assertReferencesAreInScope(references, { tenantId, organizationId });
		return { payload, stored };
	}

	/**
	 * The organization and the references of the stored sharing a body-supplied id names, read in the caller's
	 * tenant (a row of another tenant is refused by the CRUD base's `create()`), soft-deleted rows included as the
	 * upsert reads them.
	 *
	 * @param id - The body's id.
	 * @param tenantId - The caller's tenant.
	 * @returns The stored row's columns (and its version, which an upsert of it is a compare-and-set on), or `null`
	 * when the body names no stored row of the tenant.
	 * @throws BadRequestException when the id is not a string: an object would be handed to the lookup (and to the
	 * upsert's) as a criterion rather than compared as a value.
	 */
	private async findStoredSharing(id: unknown, tenantId: ID | null): Promise<IStoredSharingRow | null> {
		if (id === undefined || id === null || id === '') {
			return null;
		}
		if (typeof id !== 'string') {
			throw new BadRequestException('The id of an equipment sharing must be a string');
		}
		if (!tenantId) {
			return null;
		}
		return await this.typeOrmRepository.findOne({
			where: { id, tenantId },
			select: {
				id: true,
				organizationId: true,
				equipmentId: true,
				equipmentSharingPolicyId: true,
				version: true
			},
			withDeleted: true
		} as any);
	}

	/**
	 * Removes a sharing for the recreate of its edit (`EquipmentSharingUpdateHandler`), only at the version the edit is
	 * based on, with the request approval recorded beside it.
	 *
	 * This is the edit's compare-and-set: `DELETE … WHERE id = :id AND version = :expected`, in the caller's tenant and
	 * organization boundary. Of two edits based on the same version, one removes the row and recreates it at the next
	 * version, and the other matches nothing and is refused before it has removed or written anything — so two edits
	 * can no longer recreate the row one over the other and interleave their columns.
	 *
	 * @param id - The sharing.
	 * @param expected - The version the edit is based on; `null` for a row stored without one, removed as before.
	 * @throws ApiException 409 `ENTITY_VERSION_CONFLICT` when the row has moved on, or is being replaced.
	 */
	public async deleteAtVersion(id: ID, expected: number | null): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const result = await super.delete(this.atVersion(id, expected));

		if (!affectedRows(result)) {
			throw await this.versionConflict(id, expected);
		}
		// As `delete()` does: the approval row is removed on a raw repository, so only once the sharing row was
		// really the caller's, and only inside the caller's tenant.
		if (tenantId) {
			await this.typeOrmRequestApprovalRepository.delete({ requestId: id, tenantId });
		}
	}

	/**
	 * Writes columns of a sharing only at a version: `UPDATE … SET …, version = version + 1 WHERE id = :id AND
	 * version = :expected`, one statement, in the caller's tenant and organization boundary (the CRUD base's
	 * `update`). TypeORM increments the `@VersionColumn` in that statement, and `CrudService.update` does on MikroORM,
	 * unless the patch states the version itself.
	 *
	 * @param id - The sharing.
	 * @param expected - The version the write is based on; `null` for a row stored without one, written as before.
	 * @param patch - The columns to write.
	 * @throws ApiException 409 `ENTITY_VERSION_CONFLICT` when the row has moved on.
	 */
	public async updateAtVersion(id: ID, expected: number | null, patch: Partial<EquipmentSharing>): Promise<void> {
		const result = await super.update(this.atVersion(id, expected), patch as any);

		if (!affectedRows(result)) {
			throw await this.versionConflict(id, expected);
		}
	}

	/** The criteria of a write predicated on a version. */
	private atVersion(id: ID, expected: number | null): FindOptionsWhere<EquipmentSharing> {
		return (expected === null ? { id } : { id, version: expected }) as FindOptionsWhere<EquipmentSharing>;
	}

	/**
	 * The 409 for a write whose precondition matched no row, with the version the row holds now when it can be read:
	 * the read is diagnostic, and a failure to make it leaves the conflict standing without it.
	 *
	 * @param id - The sharing.
	 * @param expected - The version the write was predicated on.
	 */
	private async versionConflict(id: ID, expected: number | null): Promise<ApiException> {
		let actualVersion: number | null = null;
		try {
			const tenantId = RequestContext.currentTenantId();
			if (tenantId) {
				const row = await this.typeOrmRepository.findOne({
					where: { id, tenantId },
					select: { id: true, version: true }
				} as any);
				actualVersion = parseEntityVersion((row as { version?: unknown } | null)?.version);
			}
		} catch {
			// Diagnostic only: the conflict is decided already.
		}
		return sharingVersionConflict(id, expected, actualVersion);
	}

	/**
	 * Whether the equipment a new sharing names auto-approves its shares, read from the store in the sharing's scope.
	 *
	 * An equipment outside the scope, or none at all, answers `false`: a request for it is filed as `REQUESTED`.
	 *
	 * @param equipmentId - The equipment the sharing names.
	 * @param scope - The tenant/organization the sharing is filed in.
	 */
	public async autoApprovesShare(equipmentId: ID | undefined, scope: IReferenceScope): Promise<boolean> {
		if (!equipmentId || !scope.tenantId) {
			return false;
		}
		const equipment = await this.typeOrmRepository.manager.findOne('equipment', {
			where: {
				id: equipmentId,
				tenantId: scope.tenantId,
				...(scope.organizationId ? { organizationId: scope.organizationId } : {})
			} as any
		});
		return (equipment as { autoApproveShare?: boolean } | null)?.autoApproveShare === true;
	}

	/**
	 * Retrieves equipment sharing records associated with a specific organization.
	 *
	 * @param organizationId - The unique identifier of the organization.
	 * @returns A promise that resolves to an array of equipment sharing records.
	 */
	async findEquipmentSharingsByOrganizationId(organizationId: ID): Promise<IPagination<IEquipmentSharing>> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const tenantId = RequestContext.currentTenantId();
				const [items, total] = await this.mikroOrmRepository.findAndCount({ tenantId, organizationId } as any, {
					populate: ['employees', 'teams', 'equipment', 'equipmentSharingPolicy'] as any[]
				});
				return { items: items.map((e) => this.serialize(e)) as EquipmentSharing[], total };
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmRepository.createQueryBuilder('equipment_sharing');
				query
					.leftJoinAndSelect(`${query.alias}.employees`, 'employees')
					.leftJoinAndSelect(`${query.alias}.teams`, 'teams')
					.innerJoinAndSelect(`${query.alias}.equipment`, 'equipment')
					.leftJoinAndSelect(`${query.alias}.equipmentSharingPolicy`, 'equipmentSharingPolicy');

				switch (this.configService.dbConnectionOptions.type as DatabaseTypeEnum) {
					case DatabaseTypeEnum.sqlite:
					case DatabaseTypeEnum.betterSqlite3:
						query.leftJoinAndSelect(
							'request_approval',
							'requestApproval',
							'"equipment_sharing"."id" = "requestApproval"."requestId"'
						);
						break;
					case DatabaseTypeEnum.postgres:
						query.leftJoinAndSelect(
							'request_approval',
							'requestApproval',
							'uuid(equipment_sharing.id) = uuid(requestApproval.requestId)'
						);
						break;
					case DatabaseTypeEnum.mysql:
						// MySQL's UUID() takes no argument: the PostgreSQL cast failed the whole query (as in pagination())
						query.leftJoinAndSelect(
							'request_approval',
							'requestApproval',
							p(`"equipment_sharing"."id" = "requestApproval"."requestId"`)
						);
						break;
					default:
						throw new Error(
							`Cannot create query to find equipment sharings by organizationId due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
						);
				}

				const [items, total] = await query
					.leftJoinAndSelect('requestApproval.approvalPolicy', 'approvalPolicy')
					.where(
						new Brackets((qb: WhereExpressionBuilder) => {
							const tenantId = RequestContext.currentTenantId();
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
							qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
						})
					)
					.getManyAndCount();

				return { items, total };
			}
		}
	}

	/**
	 * Retrieves equipment sharing records associated with a specific employee.
	 *
	 * @param id - The unique identifier of the employee.
	 * @returns A promise that resolves to a pagination object containing an array of equipment sharing records and the total count.
	 * @throws BadRequestException if an error occurs during the database query.
	 */
	async findEquipmentSharingsByEmployeeId(id: ID): Promise<IPagination<IEquipmentSharing>> {
		try {
			return await this.findAll({
				where: {
					createdByUserId: id
				},
				relations: {
					employees: true,
					teams: true,
					equipment: true
				}
			});
		} catch (error) {
			console.error('Error finding equipment sharings by employee ID:', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Retrieves all equipment sharing records with pagination.
	 *
	 * This function uses `findAndCount` to fetch all equipment sharing records along with the total
	 * count. It loads related entities (`equipment`, `employees`, and `teams`) and returns an object
	 * containing both the items and the total count.
	 *
	 * @returns A promise that resolves to an object with `items` (the equipment sharing records)
	 *          and `total` (the total number of records).
	 */
	async findAllEquipmentSharings(): Promise<IPagination<IEquipmentSharing>> {
		return await this.findAll({
			relations: {
				employees: true,
				teams: true,
				equipment: true
			}
		});
	}

	/**
	 * Creates a new EquipmentSharing record.
	 *
	 * @param equipmentSharing - The EquipmentSharing entity to be created.
	 * @returns The saved EquipmentSharing entity.
	 */
	async createEquipmentSharing(entity: IEquipmentSharingCreateInput): Promise<EquipmentSharing> {
		try {
			// Save the equipment sharing record using tenant-aware save
			const equipmentSharing = await this.save(entity);
			return equipmentSharing;
		} catch (error) {
			console.error('Error creating equipment sharing:', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Updates an equipment sharing record by deleting the existing record and saving the updated input.
	 *
	 * @param id - The unique identifier for the equipment sharing record to update.
	 * @param input - The new equipment sharing data.
	 * @returns A promise that resolves to the updated EquipmentSharing record.
	 */
	async update(id: ID, input: IEquipmentSharingUpdateInput): Promise<EquipmentSharing> {
		try {
			// Use parent's tenant-scoped delete instead of direct repository access
			await super.delete(id);

			// Save the new equipment sharing data with tenant scoping, under the SAME id: the body is not
			// guaranteed to carry one, and a delete-then-insert without it replaced the record with a stub
			// (approve/refuse goes through here).
			const equipmentSharing = await this.save({ ...input, id });

			// Return the newly saved record
			return equipmentSharing;
		} catch (err) {
			// If an error occurs, throw a BadRequestException with the error details
			throw new BadRequestException(err);
		}
	}

	/**
	 * Deletes an equipment sharing record and its associated request approval.
	 *
	 * This function concurrently deletes the equipment sharing record from the primary repository
	 * and the corresponding request approval record from the request approval repository.
	 *
	 * @param id - The unique identifier for the equipment sharing record to be deleted.
	 * @returns A promise that resolves to the result of the equipment sharing deletion operation.
	 */
	async delete(id: ID): Promise<DeleteResult> {
		try {
			// The equipment-sharing delete is tenant-scoped (parent); the approval-row delete runs on a RAW
			// repository, so it must be tenant-scoped explicitly and only run once the sharing row was
			// really ours — otherwise a foreign UUID deleted another tenant's request_approval row.
			const tenantId = RequestContext.currentTenantId();
			const equipmentSharing = await super.delete(id);
			// Fail CLOSED without a tenant: `...(tenantId ? { tenantId } : {})` would leave
			// `{ requestId: id }` alone on a RAW repository, deleting any tenant's approval row that
			// happens to carry this UUID. With no tenant to scope by, the approval row is left for a
			// context that can prove ownership rather than deleted blind.
			if (equipmentSharing?.affected && tenantId) {
				await this.typeOrmRequestApprovalRepository.delete({ requestId: id, tenantId });
			}

			// Return the result from the equipment sharing deletion.
			return equipmentSharing;
		} catch (error) {
			// If an error occurs during deletion, throw a BadRequestException with error details.
			throw new BadRequestException(error);
		}
	}

	/**
	 * Updates the status of an Equipment Sharing record by an admin.
	 *
	 * The record is read in the caller's tenant, and its status is then written as a compare-and-set on the version
	 * that read found ({@link updateAtVersion}), which moves the version on. It used to be a `save()` of the copy read:
	 * `save()` writes back every column the copy differs from the stored row in, so an edit that landed between the
	 * read and the write was reverted to the copy, and the edit's author was never told.
	 *
	 * @param id - The unique identifier of the Equipment Sharing record.
	 * @param status - The new status value to set for the Equipment Sharing record.
	 * @returns A promise that resolves to the updated EquipmentSharing record.
	 * @throws ApiException 409 `ENTITY_VERSION_CONFLICT` when the record changed after it was read.
	 * @throws BadRequestException if the record is not found, or an error occurs during the update process.
	 */
	async updateStatusEquipmentSharingByAdmin(id: ID, status: number): Promise<EquipmentSharing> {
		try {
			// Use tenant-scoped lookup instead of direct repository access
			const equipmentSharing = await this.findOneByIdString(id);

			await this.updateAtVersion(
				equipmentSharing.id,
				expectedSharingVersion(undefined, equipmentSharing.version),
				{ status }
			);

			return await this.findOneByIdString(id);
		} catch (err) {
			// The conflict stands as the 409 it is; everything else is answered as before.
			if (err instanceof ApiException) {
				throw err;
			}
			throw new BadRequestException(err);
		}
	}

	/**
	 * Paginates equipment sharing records based on the provided filter.
	 *
	 * @param filter - An object containing pagination and filtering options.
	 * @returns A promise that resolves to an IPagination object containing equipment sharing records and total count.
	 */
	public async pagination(filter: any): Promise<IPagination<IEquipmentSharing>> {
		try {
			// Retrieve the current user and tenant ID from the request context
			const user = RequestContext.currentUser();
			const tenantId = RequestContext.currentTenantId();

			// Retrieve the organization ID from the filter or fallback to the current request context.
			let { employeeIds = [], organizationId } = filter?.where || {};

			// Set employeeIds based on user conditions and permissions
			if (user.employeeId && !RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				employeeIds = [user.employeeId];
			}

			const take = filter?.take ?? 10; // Default pagination limit is 10
			const skip = filter?.skip ? take * (filter.skip - 1) : 0; // Calculate the offset based on the skip value
			const order = parseSortOrder(filter?.order, SORTABLE_COLUMNS); // Requested sort, sortable columns only

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const where: any = {
						tenantId,
						organizationId,
						equipment: { tenantId, organizationId }
					};
					if (isNotEmpty(employeeIds)) {
						where.employees = { id: { $in: employeeIds }, tenantId, organizationId };
					}

					const [items, total] = await this.mikroOrmRepository.findAndCount(where, {
						populate: [
							'equipment',
							'createdByUser',
							'equipmentSharingPolicy',
							'employees',
							'teams'
						] as any[],
						orderBy: order,
						limit: take,
						offset: skip
					});
					return { items: items.map((e) => this.serialize(e)) as EquipmentSharing[], total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					// Create a query builder for the EquipmentSharing entity
					const query = this.typeOrmRepository.createQueryBuilder('equipment_sharing');
					query.innerJoinAndSelect(`${query.alias}.equipment`, 'equipment');
					query.innerJoinAndSelect(`${query.alias}.createdByUser`, 'createdByUser');
					query.leftJoinAndSelect(`${query.alias}.equipmentSharingPolicy`, 'equipmentSharingPolicy');
					query.leftJoinAndSelect(`${query.alias}.employees`, 'employees');
					query.leftJoinAndSelect(`${query.alias}.teams`, 'teams');

					switch (this.configService.dbConnectionOptions.type as DatabaseTypeEnum) {
						case DatabaseTypeEnum.sqlite:
						case DatabaseTypeEnum.betterSqlite3:
							query.leftJoinAndSelect(
								'request_approval',
								'requestApproval',
								'"equipment_sharing"."id" = "requestApproval"."requestId"'
							);
							break;
						case DatabaseTypeEnum.postgres:
							query.leftJoinAndSelect(
								'request_approval',
								'requestApproval',
								'uuid(equipment_sharing.id) = uuid(requestApproval.requestId)'
							);
							break;
						case DatabaseTypeEnum.mysql:
							query.leftJoinAndSelect(
								'request_approval',
								'requestApproval',
								p(`"equipment_sharing"."id" = "requestApproval"."requestId"`)
							);
							break;
						default:
					}

					query.leftJoinAndSelect('requestApproval.approvalPolicy', 'approvalPolicy');

					// Add new AND WHERE condition in the query builder.
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (filter.where) {
								qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
								qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), {
									organizationId
								});
								qb.andWhere(p(`"equipment"."tenantId" = :tenantId`), { tenantId });
								qb.andWhere(p(`"equipment"."organizationId" = :organizationId`), { organizationId });
							}
						})
					);
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (isNotEmpty(filter.where) && isNotEmpty(employeeIds)) {
								qb.andWhere(p(`"employees"."id" IN (:...employeeIds)`), { employeeIds });
								qb.andWhere(p(`"employees"."tenantId" = :tenantId`), { tenantId });
								qb.andWhere(p(`"employees"."organizationId" = :organizationId`), { organizationId });
							}
						})
					);

					for (const [column, direction] of Object.entries(order)) {
						query.addOrderBy(`${query.alias}.${column}`, direction);
					}

					const [items, total] = await query.skip(skip).take(take).getManyAndCount();
					return { items, total };
				}
			}
		} catch (error) {
			console.error('Error finding equipment sharings by organization ID:', error);
			throw new HttpException(
				`Error while finding equipment sharings by pagination: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
