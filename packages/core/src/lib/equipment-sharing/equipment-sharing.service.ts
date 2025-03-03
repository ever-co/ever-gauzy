import { Injectable, BadRequestException, NotFoundException, HttpStatus, HttpException } from '@nestjs/common';
import { Brackets, DeleteResult, WhereExpressionBuilder } from 'typeorm';
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
import { TypeOrmEquipmentSharingRepository } from './repository/type-orm-equipment-sharing.repository';
import { MikroOrmEquipmentSharingRepository } from './repository/mikro-orm-equipment-sharing.repository';
import { TypeOrmRequestApprovalRepository } from './../request-approval/repository/type-orm-request-approval.repository';

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
	 * Retrieves equipment sharing records associated with a specific organization.
	 *
	 * @param organizationId - The unique identifier of the organization.
	 * @returns A promise that resolves to an array of equipment sharing records.
	 */
	async findEquipmentSharingsByOrganizationId(organizationId: ID): Promise<IPagination<IEquipmentSharing>> {
		const query = this.typeOrmRepository.createQueryBuilder('equipment_sharing');
		query
			.leftJoinAndSelect(`${query.alias}.employees`, 'employees')
			.leftJoinAndSelect(`${query.alias}.teams`, 'teams')
			.innerJoinAndSelect(`${query.alias}.equipment`, 'equipment')
			.leftJoinAndSelect(`${query.alias}.equipmentSharingPolicy`, 'equipmentSharingPolicy');

		switch (this.configService.dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				query.leftJoinAndSelect(
					'request_approval',
					'requestApproval',
					'"equipment_sharing"."id" = "requestApproval"."requestId"'
				);
				break;
			case DatabaseTypeEnum.postgres:
			case DatabaseTypeEnum.mysql:
				query.leftJoinAndSelect(
					'request_approval',
					'requestApproval',
					'uuid(equipment_sharing.id) = uuid(requestApproval.requestId)'
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
					qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
				})
			)
			.getManyAndCount();

		return { items, total };
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
			const [items, total] = await this.typeOrmRepository.findAndCount({
				where: {
					createdByUserId: id
				},
				relations: {
					employees: true,
					teams: true,
					equipment: true
				}
			});
			return { items, total };
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
		const [items, total] = await this.typeOrmRepository.findAndCount({
			relations: {
				employees: true,
				teams: true,
				equipment: true
			}
		});
		return { items, total };
	}

	/**
	 * Creates a new EquipmentSharing record.
	 *
	 * @param equipmentSharing - The EquipmentSharing entity to be created.
	 * @returns The saved EquipmentSharing entity.
	 */
	async createEquipmentSharing(entity: IEquipmentSharingCreateInput): Promise<EquipmentSharing> {
		try {
			// Set the ID of the user creating this record.
			entity.createdByUserId = RequestContext.currentUserId();

			// Save the equipment sharing record in the database.
			const equipmentSharing = await this.typeOrmRepository.save(entity);
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
			// Remove the existing record with the given id
			await this.typeOrmRepository.delete(id);

			// Save the new equipment sharing data
			const equipmentSharing = await this.typeOrmRepository.save(input);

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
			// Execute both deletion operations concurrently.
			const [equipmentSharing] = await Promise.all([
				this.typeOrmRepository.delete(id),
				this.typeOrmRequestApprovalRepository.delete({ requestId: id })
			]);

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
	 * This function retrieves an Equipment Sharing record using its ID. If the record is found,
	 * it updates the status property to the provided value and saves the updated record.
	 * If the record is not found, it throws a NotFoundException.
	 *
	 * @param id - The unique identifier of the Equipment Sharing record.
	 * @param status - The new status value to set for the Equipment Sharing record.
	 * @returns A promise that resolves to the updated EquipmentSharing record.
	 * @throws NotFoundException if no Equipment Sharing record is found with the provided ID.
	 * @throws BadRequestException if an error occurs during the update process.
	 */
	async updateStatusEquipmentSharingByAdmin(id: ID, status: number): Promise<EquipmentSharing> {
		try {
			const equipmentSharing = await this.typeOrmRepository.findOneBy({ id });

			if (!equipmentSharing) {
				throw new NotFoundException('Equipment Sharing not found');
			}
			equipmentSharing.status = status;

			return await this.typeOrmRepository.save(equipmentSharing);
		} catch (err) {
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

			// Retrieve the organization ID from the filter or the request context
			let { employeeIds = [], organizationId } = filter.where;

			// Set employeeIds based on user conditions and permissions
			if (user.employeeId && !RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				employeeIds = [user.employeeId];
			}

			// Create a query builder for the EquipmentSharing entity
			const query = this.typeOrmRepository.createQueryBuilder('equipment_sharing');

			/**
			 * Pagination
			 * Sets number of entities to skip.
			 * Sets maximal number of entities to take.
			 */
			query.skip(filter && filter.skip ? filter.take * (filter.skip - 1) : 0);
			query.take(filter && filter.take ? filter.take : 10);

			query.innerJoinAndSelect(`${query.alias}.equipment`, 'equipment');
			query.innerJoinAndSelect(`${query.alias}.createdByUser`, 'createdByUser');
			query.leftJoinAndSelect(`${query.alias}.equipmentSharingPolicy`, 'equipmentSharingPolicy');
			query.leftJoinAndSelect(`${query.alias}.employees`, 'employees');
			query.leftJoinAndSelect(`${query.alias}.teams`, 'teams');

			switch (this.configService.dbConnectionOptions.type) {
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
						qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
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

			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			console.error('Error finding equipment sharings by organization ID:', error);
			throw new HttpException(
				`Error while finding equipment sharings by pagination: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
