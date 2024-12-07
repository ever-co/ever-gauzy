import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { RequestContext } from '../../../core/context';
import { EquipmentSharingUpdateCommand } from '../equipment-sharing.update.command';
import { TypeOrmEquipmentSharingRepository } from '../../repository/type-orm-equipment-sharing.repository';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';

@CommandHandler(EquipmentSharingUpdateCommand)
export class EquipmentSharingUpdateHandler implements ICommandHandler<EquipmentSharingUpdateCommand> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly typeOrmEquipmentSharingRepository: TypeOrmEquipmentSharingRepository,

		@InjectRepository(RequestApproval)
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository
	) { }

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(
		command?: EquipmentSharingUpdateCommand
	): Promise<EquipmentSharing> {
		const { id, equipmentSharing } = command;
		await this.typeOrmEquipmentSharingRepository.delete(id);

		const equipmentSharingSaved = await this.typeOrmEquipmentSharingRepository.save(equipmentSharing);

		await this.typeOrmRequestApprovalRepository.delete({
			requestId: id
		});

		const requestApproval = new RequestApproval();
		requestApproval.requestId = equipmentSharingSaved.id;
		requestApproval.status = equipmentSharingSaved.status ? equipmentSharingSaved.status : RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.createdBy = RequestContext.currentUser().id;
		requestApproval.createdByName = RequestContext.currentUser().name;
		requestApproval.name = equipmentSharing.name;
		requestApproval.min_count = 1;
		await this.typeOrmRequestApprovalRepository.save(requestApproval);
		return equipmentSharingSaved;
	}
}
