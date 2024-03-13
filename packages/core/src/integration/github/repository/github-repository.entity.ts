import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { IIntegrationTenant, IOrganizationGithubRepository, IOrganizationGithubRepositoryIssue, IOrganizationProject } from '@gauzy/contracts';
import { IntegrationTenant, OrganizationGithubRepositoryIssue, OrganizationProject, TenantOrganizationBaseEntity } from '../../../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from '../../../core/decorators/entity';
import { ColumnIndex } from './../../../core/decorators/entity/index.decorator';
import { MikroOrmOrganizationGithubRepositoryRepository } from './repository/mikro-orm-candidate.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '../../../core/decorators/entity/relations';

@MultiORMEntity('organization_github_repository', { mikroOrmRepository: () => MikroOrmOrganizationGithubRepositoryRepository })
export class OrganizationGithubRepository extends TenantOrganizationBaseEntity implements IOrganizationGithubRepository {

    @ApiProperty({ type: () => Number })
    @IsNotEmpty()
    @IsNumber()
    @ColumnIndex()
    @MultiORMColumn()
    repositoryId: number;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @ColumnIndex()
    @MultiORMColumn()
    name: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @ColumnIndex()
    @MultiORMColumn()
    fullName: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @ColumnIndex()
    @MultiORMColumn()
    owner: string;

    @ApiPropertyOptional({ type: () => Number })
    @IsNotEmpty()
    @IsNumber()
    @ColumnIndex()
    @MultiORMColumn({ nullable: true })
    issuesCount: number;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    @ColumnIndex()
    @MultiORMColumn({ nullable: true, default: true })
    hasSyncEnabled: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    @ColumnIndex()
    @MultiORMColumn({ nullable: true, default: false })
    private: boolean;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @ColumnIndex()
    @MultiORMColumn({ nullable: true })
    status: string;

    /*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

    /** What integration tenant sync to */
    @ApiProperty({ type: () => IntegrationTenant })
    @MultiORMManyToOne(() => IntegrationTenant, {
        /** Indicates if relation column value can be nullable or not. */
        nullable: true,

        /** Database cascade action on delete. */
        onDelete: 'CASCADE'
    })
    @JoinColumn()
    integration: IIntegrationTenant;

    @ApiProperty({ type: () => String })
    @IsUUID()
    @RelationId((it: OrganizationGithubRepository) => it.integration)
    @ColumnIndex()
    @MultiORMColumn({ nullable: true, relationId: true })
    integrationId: IIntegrationTenant['id'];

    /*
    |--------------------------------------------------------------------------
    | @OneToMany
    |--------------------------------------------------------------------------
    */

    /** Repository Sync Organization Projects */
    @MultiORMOneToMany(() => OrganizationProject, (it) => it.repository, {
        cascade: true
    })
    projects?: IOrganizationProject[];

    /** Repository Sync Organization Projects */
    @MultiORMOneToMany(() => OrganizationGithubRepositoryIssue, (it) => it.repository, {
        cascade: true
    })
    issues?: IOrganizationGithubRepositoryIssue[];
}
