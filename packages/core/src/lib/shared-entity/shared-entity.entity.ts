import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from "@mikro-orm/core";
import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { isMySQL, isPostgres } from "@gauzy/config";
import { ISharedEntity, IShareRule, JsonData } from "@gauzy/contracts";
import { BasePerEntityType } from "../core/entities/internal";
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from "../core/decorators/entity";
import { MikroOrmSharedEntityRepository } from "./repository/mikro-orm-shared-entity.repository";

@MultiORMEntity('shared_entity', { mikroOrmRepository: () => MikroOrmSharedEntityRepository })
export class SharedEntity extends BasePerEntityType implements ISharedEntity {
    [EntityRepositoryType]?: MikroOrmSharedEntityRepository;

    /**
     * The token that is used to identify and access the shared entity.
     */
    @ApiProperty({ type: () => String })
    @IsString()
    @IsNotEmpty()
    @ColumnIndex({ unique: true })
    @MultiORMColumn()
    token: string;

    /**
     * The rules that define how the shared entity is shared — Essentially stores entity fields and relations that are shared.
     */
    @ApiProperty({ type: () => Object })
    @IsNotEmpty()
    @IsObject()
    @MultiORMColumn({
        type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text'
     })
    shareRules: IShareRule | string;

    /**
     * The additional options for the shared entity.
     */
    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    @IsObject()
    @MultiORMColumn({
        type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text',
        nullable: true
    })
    sharedOptions?: JsonData;
}
