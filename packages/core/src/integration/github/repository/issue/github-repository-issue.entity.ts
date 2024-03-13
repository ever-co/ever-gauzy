import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { IOrganizationGithubRepository, IOrganizationGithubRepositoryIssue } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../../../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../../../core/decorators/entity';
import { OrganizationGithubRepository } from './../github-repository.entity';
import { MikroOrmOrganizationGithubRepositoryIssueRepository } from './repository/mikro-orm-github-repository-issue.repository';

@MultiORMEntity('organization_github_repository_issue', { mikroOrmRepository: () => MikroOrmOrganizationGithubRepositoryIssueRepository })
export class OrganizationGithubRepositoryIssue extends TenantOrganizationBaseEntity implements IOrganizationGithubRepositoryIssue {

    @ApiProperty({ type: () => Number })
    @IsNotEmpty()
    @IsNumber()
    @ColumnIndex()
    @MultiORMColumn()
    issueId: number;

    @ApiProperty({ type: () => Number })
    @IsNotEmpty()
    @IsString()
    @ColumnIndex()
    @MultiORMColumn()
    issueNumber: number;

    /*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

    /**
     * Organization Github Repository
     */
    @MultiORMManyToOne(() => OrganizationGithubRepository, {
        /** Indicates if relation column value can be nullable or not. */
        nullable: true,

        /** Database cascade action on delete. */
        onDelete: 'SET NULL'
    })
    @JoinColumn()
    repository?: IOrganizationGithubRepository;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    @RelationId((it: OrganizationGithubRepositoryIssue) => it.repository)
    @ColumnIndex()
    @MultiORMColumn({ nullable: true, relationId: true })
    repositoryId?: IOrganizationGithubRepository['id'];
}
