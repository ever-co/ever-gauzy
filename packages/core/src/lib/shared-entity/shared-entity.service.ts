import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { DataSource, FindOneOptions, FindOptionsRelations, FindOptionsSelect, Repository } from "typeorm";

import { BaseEntityEnum, ID, ISharedEntityCreateInput, IShareRule } from "@gauzy/contracts";
import { isEmpty, isNotEmpty } from "@gauzy/utils";
import { RequestContext } from "../core/context";
import { TenantAwareCrudService } from "../core/crud";
import { MikroOrmSharedEntityRepository } from "./repository/mikro-orm-shared-entity.repository";
import { TypeOrmSharedEntityRepository } from "./repository/type-orm-shared-entity.repository";
import { SharedEntity } from "./shared-entity.entity";

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

            // Generate a unique token for the shared entity
            const token = this.generateToken();

            // Create and return the shared entity
            return await super.create({
                ...input,
                token,
                tenantId
            });
        } catch (error) {
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

            // Construct the find options for the shared entity
            const findOptions = this.buildFindOptions(sharedEntity.id, shareRules);

            // Get the entity
            const entity = await repository.findOne(findOptions);

            if (!entity) {
                throw new NotFoundException('Entity not found');
            }

            // Return the entity
            return this.filterEntity(entity, shareRules);
        } catch (error) {
            throw new BadRequestException(`Failed to get shared entity by token: ${error?.message || error}`);
        }
    }

    /**
     * Builds the find options for the shared entity.
     *
     * @param entityId - The ID of the entity.
     * @param rules - The share rules for the shared entity.
     * @returns The find options for the shared entity.
     */
    private buildFindOptions(entityId: ID, rules: IShareRule): FindOneOptions<any> {
        return {
            where: { id: entityId },
            select: this.buildSelect(rules),
            relations: this.buildRelations(rules)
        }
    }

    /**
     * Builds the select for the shared entity.
     *
     * @param rules - The share rules for the shared entity.
     * @returns The select for the shared entity.
     */
    private buildSelect(rules: IShareRule): FindOptionsSelect<any> {
        const select: FindOptionsSelect<any> = {};

        // Add the fields to the select
        for (const field of rules.fields) {
            select[field] = true;
        }

        // Add the relations to the select
        if (isNotEmpty(rules.relations)) {
            for (const [relation, subRules] of Object.entries(rules.relations)) {
                select[relation] = this.buildSelect(subRules as IShareRule);
            }
        }

        // Return the select
        return select;
    }

    /**
     * Builds the relations for the shared entity.
     *
     * @param rules - The share rules for the shared entity.
     * @returns The relations for the shared entity.
     */
    private buildRelations(rules: IShareRule): FindOptionsRelations<any> {
        if (isEmpty(rules.relations)) return {};

        const relations: FindOptionsRelations<any> = {};

        // Add the relations to the relations
        for (const [relation, subRules] of Object.entries(rules.relations)) {
            relations[relation] = isEmpty(subRules) ? true : this.buildRelations(subRules as IShareRule);
        }

        // Return the relations
        return relations;
    }

    /**
     * Filters the entity based on the share rules.
     *
     * @param entity - The entity to filter.
     * @param rules - The share rules for the shared entity.
     * @returns The filtered entity.
     */
    private filterEntity(entity: any, rules: IShareRule): any {
        const result: any = {};

        for (const field of rules.fields) {
            result[field] = entity[field];
        }

         if (rules.relations) {
            for (const [relation, subRules] of Object.entries(rules.relations)) {
                if (!entity[relation]) continue;

                if (Array.isArray(entity[relation])) {
                    result[relation] = entity[relation].map(item =>
                        this.filterEntity(item, subRules)
                    );
                } else {
                    result[relation] = this.filterEntity(entity[relation], subRules);
                }
            }
         }

        // Return the result
         return result;
    }

    /**
     * Generates a unique token for the shared entity.
     *
     * @returns A string of 32 characters.
     */
    private generateToken(): string {
        return randomBytes(16).toString('hex');
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
