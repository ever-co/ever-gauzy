import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, RelationId, } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { IIntegrationTenant, IOrganizationGithubRepository, IOrganizationProject } from '@gauzy/contracts';
import { IntegrationTenant, OrganizationProject, TenantOrganizationBaseEntity } from 'core/entities/internal';

@Entity('organization_github_repository')
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
    @Column({ nullable: true, default: false })
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
    @OneToMany(() => OrganizationProject, (it) => it.repository)
    projects?: IOrganizationProject[];
}
