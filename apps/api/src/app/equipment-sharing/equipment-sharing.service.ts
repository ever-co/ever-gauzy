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
import { RequestContext } from '../core/context';
import { RequestApprovalStatusTypesEnum } from '@gauzy/models';

@Injectable()
export class EquipmentSharingService extends CrudService<EquipmentSharing> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<
			EquipmentSharing
		>
	) {
		super(equipmentSharingRepository);
	}

	async findAllEquipmentSharings(): Promise<any> {
		return await this.equipmentSharingRepository.find({
			relations: ['equipment', 'employees', 'teams']
		});
	}

	async update(
		id: string,
		equipmentSharing: EquipmentSharing
	): Promise<EquipmentSharing> {
		try {
			await this.equipmentSharingRepository.delete(id);
			return this.equipmentSharingRepository.save(equipmentSharing);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async updateStatusRequestApprovalByAdmin(
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
			return this.equipmentSharingRepository.save(equipmentSharing);
		} catch (err /*: WriteError*/) {
			throw err;
		}
	}
}
