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
     * Called after an OrganizationProject entity is loaded from the database. This method updates
     * the entity by setting the image URL if an associated image with a full URL is present.
     *
     * @param entity The OrganizationProject entity that has been loaded.
     * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
     */
    async afterEntityLoad(entity: OrganizationProject): Promise<void> {
        try {
            // Check if the image is present and has a fullUrl
            if (entity.image && entity.image.fullUrl) {
                entity.imageUrl = entity.image.fullUrl;
            }
        } catch (error) {
            console.error('OrganizationProjectSubscriber: An error occurred during the afterEntityLoad process:', error.message);
        }
    }

    /**
     * Called before an OrganizationProject entity is inserted or created in the database.
     * This method sets initial values and prepares the entity for creation.
     *
     * @param entity The OrganizationProject entity about to be created.
     * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
     */
    async beforeEntityCreate(entity: OrganizationProject): Promise<void> {
        try {
            // Generate a dummy image URL based on the first two initials of the name, if imageUrl is not provided
            if (!entity.imageUrl && entity.name) {
                const initials = entity.name.toLowerCase().split(' ').slice(0, 2).map((elem) => elem.charAt(0)).join('');
                entity.imageUrl = getDummyImage(330, 300, initials.toUpperCase());
            }
        } catch (error) {
            console.error('OrganizationProjectSubscriber: An error occurred during the beforeEntityCreate process:', error.message);
        }
    }

    /**
     * Called after an OrganizationProject entity is created in the database. This method updates
     * the members count of the project.
     *
     * @param entity The OrganizationProject entity that was just created.
     * @param em An optional entity manager which can be either from TypeORM or MikroORM.
     * @returns {Promise<void>} A promise that resolves when the post-creation processing is complete.
     */
    async afterEntityCreate(entity: OrganizationProject, em?: MultiOrmEntityManager): Promise<void> {
        try {
            await this.updateProjectMembersCount(entity, em);
        } catch (error) {
            console.error('OrganizationProjectSubscriber: An error occurred during the afterEntityCreate process:', error.message);
        }
    }

    /**
     * Called after an OrganizationProject entity is updated in the database. This method is responsible
     * for updating the project's members count to reflect any changes made to the entity.
     *
     * @param entity The OrganizationProject entity that was just updated.
     * @param em An optional entity manager which can be either from TypeORM or MikroORM. It provides the
     *           necessary context for database operations.
     * @returns {Promise<void>} A promise that resolves when the post-update processing is complete.
     */
    async afterEntityUpdate(entity: OrganizationProject, em?: MultiOrmEntityManager): Promise<void> {
        try {
            await this.updateProjectMembersCount(entity, em);
        } catch (error) {
            console.error('OrganizationProjectSubscriber: An error occurred during the afterEntityUpdate process:', error.message);
        }
    }

    /**
     * Updates the members count of an OrganizationProject entity.
     *
     * @param entity The OrganizationProject entity for which the member count is to be updated.
     * @param em An optional entity manager which can be either from TypeORM or MikroORM.
     * @returns {Promise<void>} A promise that resolves when the members count update is complete.
     */
    async updateProjectMembersCount(entity: OrganizationProject, em?: MultiOrmEntityManager): Promise<void> {
        try {
            if (!em) {
                return;
            }

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
                    await em.getConnection().execute(updateQuery, [totalMembers, projectId]);
                }
            }
        } catch (error) {
            console.error('OrganizationProjectSubscriber: An error occurred during the updateProjectMembersCount process:', error.message);
        }
    }
}
