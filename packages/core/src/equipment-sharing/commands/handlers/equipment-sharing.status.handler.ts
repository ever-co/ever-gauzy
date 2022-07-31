import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EquipmentSharingStatusCommand } from '../equipment-sharing.status.command';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { InjectRepository } from '@nestjs/typeorm';

@CommandHandler(EquipmentSharingStatusCommand)
export class EquipmentSharingStatusHandler
	implements ICommandHandler<EquipmentSharingStatusCommand> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<EquipmentSharing>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) { }

	public async execute(
		command?: EquipmentSharingStatusCommand
	): Promise<EquipmentSharing> {
		const { id, status } = command;

		const [equipmentSharing, requestApproval] = await Promise.all([
			await this.equipmentSharingRepository.findOneBy({id}),
			await this.requestApprovalRepository.findOneBy({
				requestId: id
			})
		]);

		if (!equipmentSharing) {
			throw new NotFoundException('Equiment Sharing not found');
		}

		equipmentSharing.status = status;

		if (requestApproval) {
			requestApproval.status = status;
			await this.requestApprovalRepository.save(requestApproval);
		}

		return await this.equipmentSharingRepository.save(equipmentSharing);
	}
}
