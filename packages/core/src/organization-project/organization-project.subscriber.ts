import { EventSubscriber } from "typeorm";
import { getDummyImage } from "./../core/utils";
import { OrganizationProject } from "./organization-project.entity";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { MikroOrmEntityManager, MultiOrmEntityManager, TypeOrmEntityManager } from "../core/entities/subscribers/entity-event-subscriber.types";
import { prepareSQLQuery as p } from '../database/database.helper';

@EventSubscriber()
export class OrganizationProjectSubscriber extends BaseEntityEventSubscriber<OrganizationProject> {
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
     */
    async afterEntityLoad(entity: OrganizationProject): Promise<void> {
        try {
            if (!!entity['image']) {
                entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
            }
        } catch (error) {
            console.error('OrganizationProjectSubscriber: An error occurred during the afterEntityLoad process:', error.message);
        }
    }

    /**
     * Called before entity is inserted/created to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: OrganizationProject): Promise<void> {
        try {
            if (entity) {
                entity.membersCount = (entity.members) ? entity.members.length : 0;

                if (!entity.imageUrl && entity.name) {
                    const name = entity.name.toLowerCase().split(' ').slice(0, 2).map((elem) => elem[0]).join('');
                    entity.imageUrl = getDummyImage(330, 300, name.toUpperCase());
                }
            }
        } catch (error) {
            console.error('OrganizationProjectSubscriber: An error occurred during the beforeEntityCreate process:', error.message);
        }
    }

    /**
     * Called after entity is updated in the database.
     *
     * @param entity
     * @param em
     */
    async afterEntityUpdate(entity: OrganizationProject, em?: MultiOrmEntityManager): Promise<void> {
        try {
            const { organizationId, tenantId, id: projectId } = entity;

            let query = p(`
                SELECT COUNT(*) as count
                    FROM organization_project_employee
                INNER JOIN organization_project
                    ON "organization_project"."id" = "organization_project_employee"."organizationProjectId"
                WHERE
                    "organization_project_employee"."organizationProjectId" = $1 AND
                    "organization_project"."organizationId" = $2 AND
                    "organization_project"."tenantId" = $3
            `);

            let totalMembers = 0;

            // Handle TypeORM specific logic
            if (em instanceof TypeOrmEntityManager) {
                const result = await em.query(query, [projectId, organizationId, tenantId]);
                // Extract count from result - the structure of this may vary based on the database and driver
                totalMembers = parseInt(result[0].count ?? 0, 10);
            }
            // Handle MikroORM specific logic
            else if (em instanceof MikroOrmEntityManager) {
                // Replace $ placeholders with ? for MikroORM
                query = query.replace(/\$\d/g, '?');
                console.log(query);
                const result = await em.getConnection().execute(query, [projectId, organizationId, tenantId]);
                totalMembers = parseInt(result[0]?.count ?? 0, 10);
            }

            // Update members count in both TypeORM and MikroORM
            if (totalMembers >= 0) {
                let updateQuery = p(`UPDATE "organization_project" SET "membersCount" = $1 WHERE "id" = $2`);

                // Common update logic for both ORMs
                if (em instanceof TypeOrmEntityManager) {
                    await em.query(updateQuery, [totalMembers, projectId]);
                } else if (em instanceof MikroOrmEntityManager) {
                    console.log(updateQuery);
                    await em.getConnection().execute(updateQuery, [totalMembers, projectId]);
                }
            }
        } catch (error) {
            console.error('OrganizationProjectSubscriber: An error occurred during the afterEntityUpdate process:', error.message);
        }
    }
}
