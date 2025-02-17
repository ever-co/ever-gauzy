import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';
import { ID, IEmployee, IResourceLink, IURLMetaData } from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BasePerEntityType, Employee } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmResourceLinkRepository } from './repository/mikro-orm-resource-link.repository';

@MultiORMEntity('resource_link', { mikroOrmRepository: () => MikroOrmResourceLinkRepository })
export class ResourceLink extends BasePerEntityType implements IResourceLink {
	[EntityRepositoryType]?: MikroOrmResourceLinkRepository;

	/**
	 * The title of the resource link.
	 * This property holds a brief and descriptive title representing the resource.
	 */
	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	/**
	 * The URL of the resource.
	 * This property stores the link to the resource associated with the entry.
	 */
	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsUrl()
	@MultiORMColumn({ type: 'text' })
	url: string;

	/**
	 * Metadata associated with the resource.
	 * This property stores additional data that can vary in type depending on the database.
	 * For SQLite, it's stored as a text string, otherwise as a JSON object.
	 */
	@ApiPropertyOptional({ type: () => (isSqlite() || isBetterSqlite3() ? String : Object) })
	@IsOptional()
	@MultiORMColumn({ nullable: true, type: isSqlite() || isBetterSqlite3() ? 'text' : 'json' })
	metaData?: string | IURLMetaData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Resource Link Author (Employee).
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * Resource Link Author ID.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ResourceLink) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;
}
