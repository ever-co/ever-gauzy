import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EquipmentSharingStatusCommand } from '../equipment-sharing.status.command';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { TypeOrmEquipmentSharingRepository } from '../../repository/type-orm-equipment-sharing.repository';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';

@CommandHandler(EquipmentSharingStatusCommand)
export class EquipmentSharingStatusHandler implements ICommandHandler<EquipmentSharingStatusCommand> {

	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly typeOrmEquipmentSharingRepository: TypeOrmEquipmentSharingRepository,

		@InjectRepository(RequestApproval)
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository
	) { }

	public async execute(
		command?: EquipmentSharingStatusCommand
	): Promise<EquipmentSharing> {
		const { id, status } = command;

		const [equipmentSharing, requestApproval] = await Promise.all([
			await this.typeOrmEquipmentSharingRepository.findOneBy({ id }),
			await this.typeOrmRequestApprovalRepository.findOneBy({ requestId: id })
		]);

		if (!equipmentSharing) {
			throw new NotFoundException('Equiment Sharing not found');
		}

		equipmentSharing.status = status;

		if (requestApproval) {
			requestApproval.status = status;
			await this.typeOrmRequestApprovalRepository.save(requestApproval);
		}

		return await this.typeOrmEquipmentSharingRepository.save(equipmentSharing);
	}
}
