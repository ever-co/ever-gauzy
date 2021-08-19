import { Column, Entity, Index, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { IExpense, IOrganizationVendor, ITag } from '@gauzy/contracts';
import { Expense, Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('organization_vendor')
export class OrganizationVendor
	extends TenantOrganizationBaseEntity
	implements IOrganizationVendor {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	email?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	phone?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	website?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Expense
	 */
	@ApiPropertyOptional({ type: () => Expense, isArray: true })
	@OneToMany(() => Expense, (it) => it.vendor)
	expenses?: IExpense[];

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Tag
	 */
	@ApiPropertyOptional({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.organizationVendor)
	@JoinTable({
		name: 'tag_organization_vendor'
	})
	tags?: ITag[];
}
