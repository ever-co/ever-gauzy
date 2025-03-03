import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { IEquipmentSharing } from '@gauzy/contracts';
import { EquipmentSharingStatusCommand } from '../equipment-sharing.status.command';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';
import { EquipmentSharingService } from '../../equipment-sharing.service';

@CommandHandler(EquipmentSharingStatusCommand)
export class EquipmentSharingStatusHandler implements ICommandHandler<EquipmentSharingStatusCommand> {
	constructor(
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,
		private readonly equipmentSharingService: EquipmentSharingService
	) {}

	/**
	 * Updates the status of an Equipment Sharing record and its corresponding Request Approval.
	 *
	 * @param command - An object containing the equipment sharing record's ID and the new status.
	 * @returns A promise that resolves to the updated Equipment Sharing record.
	 */
	public async execute(command: EquipmentSharingStatusCommand): Promise<IEquipmentSharing> {
		const { id, status } = command;

		// Retrieve the equipment sharing record and its associated request approval concurrently.
		const [equipmentSharing, requestApproval] = await Promise.all([
			this.equipmentSharingService.findOneByIdString(id),
			this.typeOrmRequestApprovalRepository.findOneBy({ requestId: id })
		]);

		// If the equipment sharing record is not found, throw an exception.
		if (!equipmentSharing) {
			throw new NotFoundException('Equipment Sharing not found');
		}

		// Update the equipment sharing status.
		equipmentSharing.status = status;

		// If a corresponding request approval exists, update its status as well.
		if (requestApproval) {
			requestApproval.status = status;
			await this.typeOrmRequestApprovalRepository.save(requestApproval);
		}

		// Persist and return the updated equipment sharing record.
		return await this.equipmentSharingService.update(id, equipmentSharing);
	}
}
