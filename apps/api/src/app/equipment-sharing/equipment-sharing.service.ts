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
	ApprovalPolicyTypesEnum,
	EquipmentSharing as IEquipmentSharing
} from '@gauzy/models';
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
			requestApproval.name = equipmentSharing.name;
			requestApproval.type = ApprovalPolicyTypesEnum.EQUIPMENT_SHARING;
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
			const requestApproval = new RequestApproval();
			requestApproval.id = equipmentSharingSaved.id;
			requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.approvalPolicyId =
				equipmentSharing.approvalPolicyId;
			requestApproval.createdBy = RequestContext.currentUser().id;
			requestApproval.name = equipmentSharing.name;
			requestApproval.type = ApprovalPolicyTypesEnum.EQUIPMENT_SHARING;
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
