import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import {
	RequestApprovalStatusTypesEnum,
	ApprovalPolicyTypesStringEnum
} from '@gauzy/models';
import { EquipmentSharingCreateCommand } from '../equipment-sharing.create.command';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { RequestContext } from '../../../core/context';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@CommandHandler(EquipmentSharingCreateCommand)
export class EquipmentSharingCreateHandler
	implements ICommandHandler<EquipmentSharingCreateCommand> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<
			EquipmentSharing
		>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) {}

	public async execute(
		command?: EquipmentSharingCreateCommand
	): Promise<EquipmentSharing> {
		const { equipmentSharing } = command;
		equipmentSharing.createdBy = RequestContext.currentUser().id;
		equipmentSharing.createdByName = RequestContext.currentUser().name;
		const equipmentSharingSaved = await this.equipmentSharingRepository.save(
			equipmentSharing
		);
		const requestApproval = new RequestApproval();
		requestApproval.requestId = equipmentSharingSaved.id;
		requestApproval.requestType =
			ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING;
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
