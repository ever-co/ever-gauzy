import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, FindOneOptions, Repository } from "typeorm";

import { BaseEntityEnum, ID, ISharedEntityCreateInput, IShareRule } from "@gauzy/contracts";
import { RequestContext } from "../core/context";
import { TenantAwareCrudService } from "../core/crud";
import { MikroOrmSharedEntityRepository } from "./repository/mikro-orm-shared-entity.repository";
import { TypeOrmSharedEntityRepository } from "./repository/type-orm-shared-entity.repository";
import { SharedEntity } from "./shared-entity.entity";
import { buildSharedEntityRelations, buildSharedEntitySelect, filterSharedEntity, generateSharedEntityToken } from "./shared-entity.helper";

@Injectable()
export class SharedEntityService extends TenantAwareCrudService<SharedEntity> {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        typeOrmSharedEntityRepository: TypeOrmSharedEntityRepository,
        mikroOrmSharedEntityRepository: MikroOrmSharedEntityRepository
    ) {
        super(typeOrmSharedEntityRepository, mikroOrmSharedEntityRepository);
    }

    /**
     * Creates a new shared entity.
     *
     * @param input - The input data for creating a shared entity.
     * @returns A promise that resolves to the created shared entity.
     * @throws {BadRequestException} If an error occurs during the creation of the shared entity.
     */
    async create(input: ISharedEntityCreateInput): Promise<SharedEntity> {
        try {
            // Extract the tenant ID from the request context, or use the provided tenantId
            const tenantId = RequestContext.currentTenantId() || input.tenantId;

            // Security: only allow sharing a record that belongs to the caller's tenant. Without this
            // check a user could create a share-link pointing at another tenant's record by its id
            // (cross-tenant IDOR - GHSA-gpg5-qwjc-8hqh / GHSA-cx2q-xmh2-pc38).
            const targetRepository = this.resolveRepository(input.entity);
            const owned = await targetRepository.findOne({ where: { id: input.entityId, tenantId } });
            if (!owned) {
                throw new ForbiddenException('Cannot share an entity that does not belong to your tenant');
            }

            // Generate a unique token for the shared entity
            const token = generateSharedEntityToken();

            // Create and return the shared entity
            return await super.create({
                ...input,
                token,
                tenantId
            });
        } catch (error) {
            // Preserve intentional HTTP exceptions (e.g. the ownership ForbiddenException above)
            if (error instanceof HttpException) {
                throw error;
            }
            throw new BadRequestException(`Failed to create shared entity: ${error?.message || error}`);
        }
    }

    /**
     * Gets a shared entity by token.
     *
     * @param token - The token of the shared entity.
     * @returns The shared entity.
     * @throws {NotFoundException} If the shared entity is not found.
     */
    async getSharedEntityByToken(token: string): Promise<any>  {
        try {
            // Get the shared entity by token
            const sharedEntity = await this.findOneByOptions({
                where: { token }
            });

            if (!sharedEntity) {
                throw new NotFoundException('Shared entity not found');
            }

            const shareRules = sharedEntity.shareRules as IShareRule;

            // Get the repository for the shared entity
            const repository = this.resolveRepository(sharedEntity.entity);

            // Construct the find options for the shared entity.
            // Scope the lookup to the share's OWN tenant so a token issued by tenant A can never
            // resolve a record belonging to tenant B (the route is @Public(), so there is no
            // request-context tenant to rely on) - GHSA-gpg5-qwjc-8hqh / GHSA-cx2q-xmh2-pc38.
            const findOptions = this.buildFindOptions(sharedEntity.entityId, sharedEntity.tenantId, shareRules);

            // Get the entity
            const entity = await repository.findOne(findOptions);

            if (!entity) {
                throw new NotFoundException('Entity not found');
            }

            // Return the entity
            return filterSharedEntity(entity, shareRules);
        } catch (error) {
            throw new NotFoundException(`Failed to get shared entity by token: ${error?.message || error}`);
        }
    }

    /**
     * Builds the find options for the shared entity.
     *
     * @param entityId - The ID of the entity.
     * @param tenantId - The tenant ID the shared entity belongs to (used to enforce tenant isolation).
     * @param rules - The share rules for the shared entity.
     * @returns The find options for the shared entity.
     */
    private buildFindOptions(entityId: ID, tenantId: ID, rules: IShareRule): FindOneOptions<any> {
        return {
            where: { id: entityId, tenantId },
            select: buildSharedEntitySelect(rules),
            relations: buildSharedEntityRelations(rules)
        }
    }

    /**
     * Resolves the repository for the given entity name.
     *
     * @param entityName - The name of the entity.
     * @returns The repository for the given entity name.
     * @throws {BadRequestException} If the repository for the given entity name is not found.
     */
    private resolveRepository(entityName: BaseEntityEnum): Repository<any> {
        const repository = this.dataSource.getRepository(entityName);
        if (!repository) {
            throw new BadRequestException(`Repository for entity "${entityName}" not found`);
        }
        return repository;
    }
}
