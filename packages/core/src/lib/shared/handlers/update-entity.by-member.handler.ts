import { BadRequestException } from '@nestjs/common';
import { In } from 'typeorm';
import { IEditEntityByMemberInput } from '@gauzy/contracts';
import { CrudService } from '../../core/crud';

export abstract class UpdateEntityByMembersHandler {
	//TODO: Change CrudService<any> to be more specific
	constructor(private readonly crudService: CrudService<any>) {}

	public async executeCommand(input: IEditEntityByMemberInput): Promise<any> {
		try {
			const { organizationId, addedEntityIds = [], removedEntityIds = [], member } = input;

			console.log(
				'UpdateEntityByMembersHandler called for Employee: ',
				member?.id,
				'for organizationId: ',
				organizationId
			);

			if (addedEntityIds && addedEntityIds.length > 0) {
				const entitiesToAdd = await this.crudService.find({
					where: {
						id: In(addedEntityIds),
						organizationId
					},
					relations: {
						members: true
					}
				});
				for await (const entity of entitiesToAdd) {
					const existingMembers = entity.members || [];
					//Note: This does not really create anything, just calls repository.save on the given id.
					//Cannot call update here because update will not update relations (members)
					await this.crudService.create({
						id: entity.id,
						members: [...existingMembers, member]
					});
				}
			}
			if (removedEntityIds && removedEntityIds.length > 0) {
				const entitiesToRemove = await this.crudService.find({
					where: {
						id: In(removedEntityIds),
						organizationId
					},
					relations: {
						members: true
					}
				});
				for await (const entity of entitiesToRemove) {
					//Note: This does not really create anything, just calls repository.save on the given id.
					//Cannot call update here because update will not update relations (members)
					const members = (entity.members || []).filter((e) => e.id !== member.id);
					await this.crudService.create({
						id: entity.id,
						members
					});
				}
			}
			return true;
		} catch (error) {
			console.log('Error while updating entity by member', error);
			throw new BadRequestException(error);
		}
	}
}
