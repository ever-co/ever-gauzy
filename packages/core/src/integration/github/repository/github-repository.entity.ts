import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, RelationId, } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { IIntegrationTenant, IOrganizationGithubRepository, IOrganizationProject } from '@gauzy/contracts';
import { IntegrationTenant, OrganizationProject, TenantOrganizationBaseEntity } from 'core/entities/internal';

@Entity('organization_github_repository')
export class OrganizationGithubRepository extends TenantOrganizationBaseEntity implements IOrganizationGithubRepository {

    @ApiProperty({ type: () => Number })
    @Index()
    @Column()
    repositoryId: number;

    @ApiProperty({ type: () => String })
    @Index()
    @Column()
    name: string;

    @ApiProperty({ type: () => String })
    @Index()
    @Column()
    fullName: string;

    @ApiProperty({ type: () => String })
    @Index()
    @Column()
    owner: string;

    /*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

    /**
     * Integration Tenant
     */
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

    /**
     * Repository Sync Organization Projects
     */
    @OneToMany(() => OrganizationProject, (it) => it.repository)
    projects?: IOrganizationProject[];
}
