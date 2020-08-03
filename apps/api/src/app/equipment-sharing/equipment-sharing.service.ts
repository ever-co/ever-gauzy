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
import {
	RequestApprovalStatusTypesEnum,
	ApprovalPolicyTypesStringEnum
} from '@gauzy/models';
import { RequestContext } from '../core/context';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';

@Injectable()
export class EquipmentSharingService extends CrudService<EquipmentSharing> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<
			EquipmentSharing
		>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,
		@InjectRepository(ApprovalPolicy)
		private readonly approvalPolicyRepository: Repository<ApprovalPolicy>
	) {
		super(equipmentSharingRepository);
	}

	async findEquipmentSharingsByOrgId(organizationId: string): Promise<any> {
		try {
			return await this.equipmentSharingRepository
				.createQueryBuilder('equipment_sharing')
				.leftJoinAndSelect('equipment_sharing.employees', 'employees')
				.leftJoinAndSelect('equipment_sharing.teams', 'teams')
				.innerJoinAndSelect('equipment_sharing.equipment', 'equipment')
				.leftJoinAndSelect(
					'request_approval',
					'request_approval',
					'"equipment_sharing"."id"::"varchar" = "request_approval"."requestId"'
				)
				.leftJoinAndSelect(
					'request_approval.approvalPolicy',
					'approvalPolicy'
				)
				.where('approvalPolicy.organizationId =:organizationId', {
					organizationId
				})
				.andWhere('approvalPolicy.approvalType =:approvalType', {
					approvalType:
						ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING
				})
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
		organizationId: string,
		equipmentSharing: EquipmentSharing
	): Promise<EquipmentSharing> {
		try {
			equipmentSharing.createdBy = RequestContext.currentUser().id;
			equipmentSharing.createdByName = RequestContext.currentUser().name;
			const equipmentSharingSaved = await this.equipmentSharingRepository.save(
				equipmentSharing
			);
			const requestApproval = new RequestApproval();
			requestApproval.requestId = equipmentSharingSaved.id;
			requestApproval.status = equipmentSharingSaved.status
				? equipmentSharingSaved.status
				: RequestApprovalStatusTypesEnum.REQUESTED;
			const approvalPolicy = await this.approvalPolicyRepository.findOne({
				where: {
					approvalType:
						ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
					organizationId: organizationId
				}
			});

			if (approvalPolicy) {
				requestApproval.approvalPolicyId = approvalPolicy.id;
			}
			requestApproval.createdBy = RequestContext.currentUser().id;
			requestApproval.createdByName = RequestContext.currentUser().name;
			requestApproval.name = equipmentSharing.name;
			requestApproval.min_count = 1;
			await this.requestApprovalRepository.save(requestApproval);
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

			const oldRequestApproval = await this.requestApprovalRepository.findOne(
				{
					requestId: id
				}
			);

			await this.requestApprovalRepository.delete({
				requestId: id
			});

			const requestApproval = new RequestApproval();
			requestApproval.requestId = equipmentSharingSaved.id;
			requestApproval.status = equipmentSharingSaved.status
				? equipmentSharingSaved.status
				: RequestApprovalStatusTypesEnum.REQUESTED;

			requestApproval.approvalPolicyId =
				oldRequestApproval.approvalPolicyId;
			requestApproval.createdBy = RequestContext.currentUser().id;
			requestApproval.createdByName = RequestContext.currentUser().name;
			requestApproval.name = equipmentSharing.name;
			requestApproval.min_count = 1;
			await this.requestApprovalRepository.save(requestApproval);
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

	async updateStatusRequestApprovalByAdmin(
		id: string,
		status: number
	): Promise<EquipmentSharing> {
		try {
			const [equipmentSharing, requestApproval] = await Promise.all([
				await this.equipmentSharingRepository.findOne(id),
				await this.requestApprovalRepository.findOne({
					requestId: id
				})
			]);

			if (!equipmentSharing) {
				throw new NotFoundException('Equiment Sharing not found');
			}
			if (
				equipmentSharing.status ===
				RequestApprovalStatusTypesEnum.REQUESTED
			) {
				equipmentSharing.status = status;
				if (requestApproval) {
					requestApproval.status = status;
					await this.requestApprovalRepository.save(requestApproval);
				}
			} else {
				throw new ConflictException('Equiment Sharing is Conflict');
			}
			return await this.equipmentSharingRepository.save(equipmentSharing);
		} catch (err) {
			throw err;
		}
	}
}
