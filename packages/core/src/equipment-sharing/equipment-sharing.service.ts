import { CrudService } from '../core';
import {
	Injectable,
	BadRequestException,
	NotFoundException,
	ConflictException
} from '@nestjs/common';
import { EquipmentSharing } from './equipment-sharing.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { getConfig } from '@gauzy/config';
const config = getConfig();
@Injectable()
export class EquipmentSharingService extends CrudService<EquipmentSharing> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<EquipmentSharing>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
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
				.leftJoinAndSelect(
					`${query.alias}.equipmentSharingPolicy`,
					'equipmentSharingPolicy'
				);

			if (config.dbConnectionOptions.type === 'sqlite') {
				query.leftJoinAndSelect(
					'request_approval',
					'request_approval',
					'"equipment_sharing"."id" = "request_approval"."requestId"'
				);
			} else {
				query.leftJoinAndSelect(
					'request_approval',
					'request_approval',
					'"equipment_sharing"."id"::"varchar" = "request_approval"."requestId"'
				);
			}
			return await query
				.leftJoinAndSelect(
					'request_approval.approvalPolicy',
					'approvalPolicy'
				)
				.where(
					'equipmentSharingPolicy.organizationId =:organizationId',
					{
						organizationId
					}
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

	async findAllEquipmentSharings(): Promise<any> {
		return await this.equipmentSharingRepository.find({
			relations: ['equipment', 'employees', 'teams']
		});
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
			if (
				equipmentSharing.status ===
				RequestApprovalStatusTypesEnum.REQUESTED
			) {
				equipmentSharing.status = status;
			} else {
				throw new ConflictException('Equiment Sharing is Conflict');
			}
			return await this.equipmentSharingRepository.save(equipmentSharing);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
