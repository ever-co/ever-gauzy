import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { RequestApprovalStatusTypesEnum } from '@gauzy/models';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { RequestContext } from '../../../core/context';
import { EquipmentSharingUpdateCommand } from '../equipment-sharing.update.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@CommandHandler(EquipmentSharingUpdateCommand)
export class EquipmentSharingUpdateHandler
	implements ICommandHandler<EquipmentSharingUpdateCommand> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<
			EquipmentSharing
		>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) {}

	public async execute(
		command?: EquipmentSharingUpdateCommand
	): Promise<EquipmentSharing> {
		const { id, equipmentSharing } = command;

		await this.equipmentSharingRepository.delete(id);
		const equipmentSharingSaved = await this.equipmentSharingRepository.save(
			equipmentSharing
		);

		await this.requestApprovalRepository.delete({
			requestId: id
		});

		const requestApproval = new RequestApproval();
		requestApproval.requestId = equipmentSharingSaved.id;
		requestApproval.status = equipmentSharingSaved.status
			? equipmentSharingSaved.status
			: RequestApprovalStatusTypesEnum.REQUESTED;

		requestApproval.createdBy = RequestContext.currentUser().id;
		requestApproval.createdByName = RequestContext.currentUser().name;
		requestApproval.name = equipmentSharing.name;
		requestApproval.min_count = 1;
		await this.requestApprovalRepository.save(requestApproval);

		return equipmentSharingSaved;
	}
}
