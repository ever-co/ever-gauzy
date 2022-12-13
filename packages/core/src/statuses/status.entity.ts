import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { IOrganizationProject, IStatus } from '@gauzy/contracts';
import { OrganizationProject, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('status')
export class Status extends TenantOrganizationBaseEntity implements IStatus {

	@Index()
	@Column()
	name: string;

	@Index()
	@Column()
	value: string;

	@Column({ nullable: true })
	description?: string;

	@Column({ nullable: true })
	icon?: string;

	@Column({ nullable: true })
	color?: string;

	@Column({ default: false })
	isSystem?: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * Organization Project
	 */
	@ManyToOne(() => OrganizationProject)
	project?: IOrganizationProject;

	@RelationId((it: Status) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];
}