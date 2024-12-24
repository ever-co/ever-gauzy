import { JoinTable } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { IExpense, IOrganizationVendor, ITag } from '@gauzy/contracts';
import { Expense, Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmOrganizationVendorRepository } from './repository/mikro-orm-organization-vendor.repository';

@MultiORMEntity('organization_vendor', { mikroOrmRepository: () => MikroOrmOrganizationVendorRepository })
export class OrganizationVendor extends TenantOrganizationBaseEntity implements IOrganizationVendor {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	email?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	phone?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
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
	@MultiORMOneToMany(() => Expense, (it) => it.vendor)
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
	@MultiORMManyToMany(() => Tag, (tag) => tag.organizationVendors, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_vendor',
		joinColumn: 'organizationVendorId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_organization_vendor'
	})
	tags?: ITag[];
}
