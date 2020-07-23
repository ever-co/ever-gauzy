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
import { RequestApprovalStatusTypesEnum } from '@gauzy/models';
import { RequestContext } from '../core/context';
import { RequestApproval } from '../request-approval/request-approval.entity';

@Injectable()
export class EquipmentSharingService extends CrudService<EquipmentSharing> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<
			EquipmentSharing
		>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) {
		super(equipmentSharingRepository);
	}

	async findEquipmentSharingsByOrgId(organizationId: string): Promise<any> {
		const equimentSharing = this.equipmentSharingRepository
			.createQueryBuilder('equipment_sharing')
			.innerJoinAndSelect(
				'equipment_sharing.approvalPolicy',
				'approvalPolicy'
			)
			.leftJoinAndSelect('equipment_sharing.employees', 'employees')
			.leftJoinAndSelect('equipment_sharing.teams', 'teams');

		return await equimentSharing
			.where('approvalPolicy.organizationId =:organizationId', {
				organizationId
			})
			.getMany();
	}

	async findRequestApprovalsByEmployeeId(id: string): Promise<any> {
		try {
			return await this.equipmentSharingRepository.find({
				where: {
					createdBy: id
				},
				relations: ['equipment', 'employees', 'teams', 'approvalPolicy']
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

	async create(
		equipmentSharing: EquipmentSharing
	): Promise<EquipmentSharing> {
		try {
			equipmentSharing.createdBy = RequestContext.currentUser().id;
			equipmentSharing.createdByName = RequestContext.currentUser().name;
			equipmentSharing.status = RequestApprovalStatusTypesEnum.REQUESTED;
			const equipmentSharingSaved = await this.equipmentSharingRepository.save(
				equipmentSharing
			);
			const requestApproval = new RequestApproval();
			requestApproval.id = equipmentSharingSaved.id;
			requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.approvalPolicyId =
				equipmentSharing.approvalPolicyId;
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

	async update(
		id: string,
		equipmentSharing: EquipmentSharing
	): Promise<EquipmentSharing> {
		try {
			await this.equipmentSharingRepository.delete(id);
			const equipmentSharingSaved = await this.equipmentSharingRepository.save(
				equipmentSharing
			);
			await this.requestApprovalRepository.delete(id);
			const requestApproval = new RequestApproval();
			requestApproval.id = equipmentSharingSaved.id;
			requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.approvalPolicyId =
				equipmentSharing.approvalPolicyId;
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
				await this.requestApprovalRepository.delete(id)
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
				await this.requestApprovalRepository.findOne(id)
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
		} catch (err /*: WriteError*/) {
			throw err;
		}
	}
}
