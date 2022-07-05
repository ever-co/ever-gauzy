import {
	Injectable,
	BadRequestException,
	NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, WhereExpressionBuilder } from 'typeorm';
import { IEquipmentSharing, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { ConfigService } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/common';
import { EquipmentSharing } from './equipment-sharing.entity';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { RequestApproval } from '../request-approval/request-approval.entity';

@Injectable()
export class EquipmentSharingService extends TenantAwareCrudService<EquipmentSharing> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<EquipmentSharing>,

		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,

		private readonly configService: ConfigService
	) {
		super(equipmentSharingRepository);
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
				.leftJoinAndSelect( `${query.alias}.equipmentSharingPolicy`, 'equipmentSharingPolicy');

			if (this.configService.dbConnectionOptions.type === 'sqlite') {
				query.leftJoinAndSelect(
					'request_approval',
					'requestApproval',
					'"equipment_sharing"."id" = "requestApproval"."requestId"'
				);
			} else {
				query.leftJoinAndSelect(
					'request_approval',
					'requestApproval',
					'uuid(equipment_sharing.id) = uuid(requestApproval.requestId)'
				);
			}
			return await query
				.leftJoinAndSelect(
					'requestApproval.approvalPolicy',
					'approvalPolicy'
				)
				.where(
					new Brackets((qb: WhereExpressionBuilder) => {
						const tenantId = RequestContext.currentTenantId();
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
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
		const [ items, total ] = await this.equipmentSharingRepository.findAndCount({
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
			const equipmentSharing = await this.equipmentSharingRepository.findOne(
				id
			);

			if (!equipmentSharing) {
				throw new NotFoundException('Equiment Sharing not found');
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

			if (this.configService.dbConnectionOptions.type === 'sqlite') {
				query.leftJoinAndSelect(
					'request_approval',
					'requestApproval',
					'"equipment_sharing"."id" = "requestApproval"."requestId"'
				);
			} else {
				query.leftJoinAndSelect(
					'request_approval',
					'requestApproval',
					'uuid(equipment_sharing.id) = uuid(requestApproval.requestId)'
				);
			}

			query.leftJoinAndSelect('requestApproval.approvalPolicy', 'approvalPolicy');

			/**
			 * Adds new AND WHERE condition in the query builder.
			 * Additionally you can add parameters used in where expression.
			 */
			query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (filter.where) {
						const { tenantId, organizationId } = filter.where;
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });

						qb.andWhere(`"equipment"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"equipment"."organizationId" = :organizationId`, { organizationId });
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
								qb.andWhere(`"employees"."id" IN (:...employeeIds)`, {
									employeeIds
								});
								qb.orWhere(`"${query.alias}"."createdBy" IN (:...employeeIds)`, {
									employeeIds
								});
							})
						);
						qb.andWhere(`"employees"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"employees"."organizationId" = :organizationId`, { organizationId });
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
