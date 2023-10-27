import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId, } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { IOrganizationGithubRepository, IOrganizationGithubRepositoryIssue } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from 'core/entities/internal';
import { OrganizationGithubRepository } from './../github-repository.entity';

@Entity('organization_github_repository_issue')
export class OrganizationGithubRepositoryIssue extends TenantOrganizationBaseEntity implements IOrganizationGithubRepositoryIssue {

    @ApiProperty({ type: () => Number })
    @IsNotEmpty()
    @IsNumber()
    @Index()
    @Column()
    issueId: number;

    @ApiProperty({ type: () => Number })
    @IsNotEmpty()
    @IsString()
    @Index()
    @Column()
    issueNumber: number;

    /*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

    /**
     * Organization Github Repository
     */
    @ManyToOne(() => OrganizationGithubRepository, {
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
    @Index()
    @Column({ nullable: true })
    repositoryId?: IOrganizationGithubRepository['id'];
}
