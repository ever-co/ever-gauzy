import { EditEntityByMemberInput } from '@gauzy/models';
import { In } from 'typeorm';
import { CrudService } from '../../core/crud';

export abstract class UpdateEntityByMembersHandler {
	//TODO: Change CrudService<any> to be more specific
	constructor(private readonly crudService: CrudService<any>) {}

	public async executeCommand(input: EditEntityByMemberInput): Promise<any> {
		const { addedEntityIds, removedEntityIds, member } = input;

		if (addedEntityIds && addedEntityIds.length > 0) {
			const departmentsToAdd = await this.crudService.findAll({
				where: {
					id: In(addedEntityIds)
				}
			});

			for (let i = 0; i < departmentsToAdd.total; i++) {
				const existingMembers = departmentsToAdd.items[i].members || [];

				//Note: This does not really create anything, just calls repository.save on the given id.
				//Cannot call update here because update will not update relations (members)
				await this.crudService.create({
					id: departmentsToAdd.items[i].id,
					members: [...existingMembers, member]
				});
			}
		}

		if (removedEntityIds && removedEntityIds.length > 0) {
			const departmentsToRemove = await this.crudService.findAll({
				where: {
					id: In(removedEntityIds)
				}
			});

			for (let i = 0; i < departmentsToRemove.total; i++) {
				//Note: This does not really create anything, just calls repository.save on the given id.
				//Cannot call update here because update will not update relations (members)
				await this.crudService.create({
					id: departmentsToRemove.items[i].id,
					members: (
						departmentsToRemove.items[i].members || []
					).filter((e) => e.id !== member.id)
				});
			}
		}

		return;
	}
}
