import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId, JoinColumn } from 'typeorm';
import { IsString, IsOptional, IsDateString, IsUUID, IsNotEmpty, IsEnum, IsBoolean } from 'class-validator';
import { Exclude } from 'class-transformer';
import { FileStorageProvider, FileStorageProviderEnum, ID, IScreenshot, ITimeSlot, IUser } from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	VirtualMultiOrmColumn
} from '../../core/decorators/entity';
import { TenantOrganizationBaseEntity, TimeSlot, User } from './../../core/entities/internal';
import { MikroOrmScreenshotRepository } from './repository/mikro-orm-screenshot.repository';

@MultiORMEntity('screenshot', { mikroOrmRepository: () => MikroOrmScreenshotRepository })
export class Screenshot extends TenantOrganizationBaseEntity implements IScreenshot {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	file: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	thumb?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	recordedAt?: Date;

	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@IsOptional()
	@IsEnum(FileStorageProviderEnum)
	@Exclude({ toPlainOnly: true })
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', nullable: true, enum: FileStorageProviderEnum })
	storageProvider?: FileStorageProvider;

	/*
	|--------------------------------------------------------------------------
	| Image/Screenshot Analysis Through Gauzy AI
	|--------------------------------------------------------------------------
	*/

	/**
	 * Indicates whether the image or screenshot is work-related.
	 */
	@ApiPropertyOptional({
		type: () => String,
		description: 'Specifies whether the image or screenshot is work-related.'
	})
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	isWorkRelated?: boolean;

	/**
	 * Description of the image or screenshot.
	 */
	@ApiPropertyOptional({
		type: () => String,
		description: 'Description of the image or screenshot.'
	})
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	description?: string;

	/**
	 * Applications associated with the image or screenshot.
	 */
	@ApiPropertyOptional({
		type: () => (isSqlite() || isBetterSqlite3() ? 'text' : 'json'),
		description: 'Applications associated with the image or screenshot.'
	})
	@IsOptional()
	@IsString()
	@MultiORMColumn({
		nullable: true,
		type: isSqlite() || isBetterSqlite3() ? 'text' : 'json'
	})
	apps?: string | string[];

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	fullUrl?: string;

	@VirtualMultiOrmColumn()
	thumbUrl?: string;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * TimeSlot
	 */
	@MultiORMManyToOne(() => TimeSlot, (it) => it.screenshots, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Screenshot) => it.timeSlot)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	timeSlotId?: ID;

	/**
	 * User
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Screenshot) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: ID;
}
