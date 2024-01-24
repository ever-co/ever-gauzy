import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import {
	Injectable,
	BadRequestException,
	NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, WhereExpressionBuilder } from 'typeorm';
import { IEquipmentSharing, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { ConfigService, databaseTypes } from '@gauzy/config';
import { prepareSQLQuery as p } from './../database/database.helper';
import { isNotEmpty } from '@gauzy/common';
import { EquipmentSharing } from './equipment-sharing.entity';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { isSqliteDB } from './../core/utils';

@Injectable()
export class EquipmentSharingService extends TenantAwareCrudService<EquipmentSharing> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<EquipmentSharing>,
		@MikroInjectRepository(EquipmentSharing)
		private readonly mikroEquipmentSharingRepository: EntityRepository<EquipmentSharing>,

		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,

		@MikroInjectRepository(RequestApproval)
		private readonly mikroRequestApprovalRepository: EntityRepository<RequestApproval>,

		private readonly configService: ConfigService
	) {
		super(equipmentSharingRepository, mikroEquipmentSharingRepository);
	}

	async findEquipmentSharingsByOrgId(organizationId: string): Promise<any> {
		try {
			const query = this.equipmentSharingRepository.createQueryBuilder(
				'equipment_sharing'
			);
			query
				.leftJoinAndSelect(`${query.alias}.employees`, 'employees')
				.leftJoinAndSelect(`${query.alias}.teams`, 'teams')
				.innerJoinAndSelect(`${query.alias}.equipment`, 'equipment')
				.leftJoinAndSelect(`${query.alias}.equipmentSharingPolicy`, 'equipmentSharingPolicy');

			switch (this.configService.dbConnectionOptions.type) {
				case databaseTypes.sqlite:
				case databaseTypes.betterSqlite3:
					query.leftJoinAndSelect(
						'request_approval',
						'requestApproval',
						'"equipment_sharing"."id" = "requestApproval"."requestId"'
					);
					break;
				case databaseTypes.postgres:
				case databaseTypes.mysql:
					query.leftJoinAndSelect(
						'request_approval',
						'requestApproval',
						'uuid(equipment_sharing.id) = uuid(requestApproval.requestId)'
					);
					break;
				default:
					throw Error(`cannot create query to find equipment sharings by orgId due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
			}

			return await query
				.leftJoinAndSelect(
					'requestApproval.approvalPolicy',
					'approvalPolicy'
				)
				.where(
					new Brackets((qb: WhereExpressionBuilder) => {
						const tenantId = RequestContext.currentTenantId();
						qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					})
				)
				.getMany();
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async findRequestApprovalsByEmployeeId(id: string): Promise<any> {
		try {
			return await this.equipmentSharingRepository.find({
				where: {
					createdBy: id
				},
				relations: ['equipment', 'employees', 'teams']
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async findAllEquipmentSharings(): Promise<IPagination<IEquipmentSharing>> {
		const [items, total] = await this.equipmentSharingRepository.findAndCount({
			relations: [
				'equipment',
				'employees',
				'teams'
			]
		});
		return { items, total }
	}

	async createEquipmentSharing(
		equipmentSharing: EquipmentSharing
	): Promise<EquipmentSharing> {
		try {
			equipmentSharing.createdBy = RequestContext.currentUser().id;
			equipmentSharing.createdByName = RequestContext.currentUser().name;
			const equipmentSharingSaved = await this.equipmentSharingRepository.save(
				equipmentSharing
			);
			return equipmentSharingSaved;
		} catch (err) {
			console.log('err', err);
			throw new BadRequestException(err);
		}
	}

	async update(
		id: string,
		equipmentSharing: EquipmentSharing
	): Promise<EquipmentSharing> {
		try {
			await this.equipmentSharingRepository.delete(id);
			const equipmentSharingSaved = await this.equipmentSharingRepository.save(
				equipmentSharing
			);

			return equipmentSharingSaved;
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async delete(id: string): Promise<any> {
		try {
			const [equipmentSharing] = await Promise.all([
				await this.equipmentSharingRepository.delete(id),
				await this.requestApprovalRepository.delete({
					requestId: id
				})
			]);

			return equipmentSharing;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async updateStatusEquipmentSharingByAdmin(
		id: string,
		status: number
	): Promise<EquipmentSharing> {
		try {
			const equipmentSharing = await this.equipmentSharingRepository.findOneBy({
				id
			});

			if (!equipmentSharing) {
				throw new NotFoundException('Equipment Sharing not found');
			}
			equipmentSharing.status = status;

			return await this.equipmentSharingRepository.save(equipmentSharing);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	public async pagination(filter: any): Promise<IPagination<IEquipmentSharing>> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const query = this.repository.createQueryBuilder('equipment_sharing');

			/**
			 * Pagination
			 * Sets number of entities to skip.
			 * Sets maximal number of entities to take.
			 */
			query.skip(filter && filter.skip ? (filter.take * (filter.skip - 1)) : 0);
			query.take(filter && filter.take ? (filter.take) : 10);

			query.innerJoinAndSelect(`${query.alias}.equipment`, 'equipment');
			query.leftJoinAndSelect(`${query.alias}.equipmentSharingPolicy`, 'equipmentSharingPolicy');
			query.leftJoinAndSelect(`${query.alias}.employees`, 'employees')
			query.leftJoinAndSelect(`${query.alias}.teams`, 'teams');

			switch (this.configService.dbConnectionOptions.type) {
				case databaseTypes.sqlite:
				case databaseTypes.betterSqlite3:
					query.leftJoinAndSelect(
						'request_approval',
						'requestApproval',
						'"equipment_sharing"."id" = "requestApproval"."requestId"'
					);
					break;
				case databaseTypes.postgres:
				case databaseTypes.mysql:
					query.leftJoinAndSelect(
						'request_approval',
						'requestApproval',
						'uuid(equipment_sharing.id) = uuid(requestApproval.requestId)'
					);
					break;
				default:
					throw Error(`cannot paginate equipment sharings due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
			}

			query.leftJoinAndSelect('requestApproval.approvalPolicy', 'approvalPolicy');

			/**
			 * Adds new AND WHERE condition in the query builder.
			 * Additionally you can add parameters used in where expression.
			 */
			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (filter.where) {
						const { tenantId, organizationId } = filter.where;
						qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

						qb.andWhere(p(`"equipment"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"equipment"."organizationId" = :organizationId`), { organizationId });
					}
				})
			);
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (
						isNotEmpty(filter.where) &&
						isNotEmpty(filter.where.employeeIds)
					) {
						let { employeeIds = [], organizationId } = filter.where;
						const user = RequestContext.currentUser();
						if (
							!RequestContext.hasPermission(
								PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
							)
							&& user.employeeId
						) {
							employeeIds = [user.employeeId];
						}
						qb.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								qb.andWhere(p(`"employees"."id" IN (:...employeeIds)`), {
									employeeIds
								});
								qb.orWhere(p(`"${query.alias}"."createdBy" IN (:...employeeIds)`), {
									employeeIds
								});
							})
						);
						qb.andWhere(p(`"employees"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"employees"."organizationId" = :organizationId`), { organizationId });
					}
				})
			);
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
