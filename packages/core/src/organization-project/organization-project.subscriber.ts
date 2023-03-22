import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, UpdateEvent } from 'typeorm';
import { getDummyImage } from './../core/utils';
import { OrganizationProject } from './organization-project.entity';

@EventSubscriber()
export class OrganizationProjectSubscriber implements EntitySubscriberInterface<OrganizationProject> {
	/**
	 * Indicates that this subscriber only listen to OrganizationProject events.
	 */
	listenTo() {
		return OrganizationProject;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(entity: OrganizationProject, event?: LoadEvent<OrganizationProject>): void | Promise<any> {
		try {
			if (!!entity['image']) {
				entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
			}
		} catch (error) {
			console.log(error);
		}
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param event
	 */
	beforeInsert(event: InsertEvent<OrganizationProject>): void | Promise<any> {
		try {
			if (event.entity) {
				const { entity } = event;
				entity.membersCount = entity.members ? entity.members.length : 0;
				if (!entity.imageUrl && entity.name) {
					const name = entity.name
						.toLowerCase()
						.split(' ')
						.slice(0, 2)
						.map((elem) => elem[0])
						.join('');
					entity.imageUrl = getDummyImage(330, 300, name.toUpperCase());
				}
			}
		} catch (error) {
			console.log(error);
		}
	}

	/**
	 * Called before entity is updated in the database.
	 *
	 * @param event
	 */
	beforeUpdate(event: UpdateEvent<OrganizationProject>): void | Promise<any> {
		try {
			if (event) {
				const { entity, databaseEntity } = event;
				if (entity && entity.members) {
					entity.membersCount = entity.members.length;
				} else if (databaseEntity && databaseEntity.members) {
					entity.membersCount = databaseEntity.members.length;
				}
			}
		} catch (error) {
			console.log(error);
		}
	}
}
