import { Column, Index, JoinColumn, ManyToOne, OneToMany, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { IIntegrationTenant, IOrganizationGithubRepository, IOrganizationGithubRepositoryIssue, IOrganizationProject } from '@gauzy/contracts';
import { IntegrationTenant, OrganizationGithubRepositoryIssue, OrganizationProject, TenantOrganizationBaseEntity } from '../../../core/entities/internal';
import { MultiORMEntity } from '../../../core/decorators/entity';
import { MikroOrmOrganizationGithubRepositoryRepository } from './repository/mikro-orm-candidate.repository';

@MultiORMEntity('organization_github_repository', { mikroOrmRepository: () => MikroOrmOrganizationGithubRepositoryRepository })
export class OrganizationGithubRepository extends TenantOrganizationBaseEntity implements IOrganizationGithubRepository {

    @ApiProperty({ type: () => Number })
    @IsNotEmpty()
    @IsNumber()
    @Index()
    @Column()
    repositoryId: number;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @Index()
    @Column()
    name: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @Index()
    @Column()
    fullName: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @Index()
    @Column()
    owner: string;

    @ApiPropertyOptional({ type: () => Number })
    @IsNotEmpty()
    @IsNumber()
    @Index()
    @Column({ nullable: true })
    issuesCount: number;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    @Index()
    @Column({ nullable: true, default: true })
    hasSyncEnabled: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    @Index()
    @Column({ nullable: true, default: false })
    private: boolean;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Index()
    @Column({ nullable: true })
    status: string;

    /*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

    /** What integration tenant sync to */
    @ApiProperty({ type: () => IntegrationTenant })
    @ManyToOne(() => IntegrationTenant, {
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
    @Index()
    @Column({ nullable: true })
    integrationId: IIntegrationTenant['id'];

    /*
    |--------------------------------------------------------------------------
    | @OneToMany
    |--------------------------------------------------------------------------
    */

    /** Repository Sync Organization Projects */
    @OneToMany(() => OrganizationProject, (it) => it.repository, {
        cascade: true
    })
    projects?: IOrganizationProject[];

    /** Repository Sync Organization Projects */
    @OneToMany(() => OrganizationGithubRepositoryIssue, (it) => it.repository, {
        cascade: true
    })
    issues?: IOrganizationGithubRepositoryIssue[];
}
