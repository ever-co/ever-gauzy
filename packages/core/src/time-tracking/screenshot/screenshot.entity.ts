import { RelationId, Index, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsUUID, IsNotEmpty, IsEnum, IsBoolean } from 'class-validator';
import { Exclude } from 'class-transformer';
import { FileStorageProviderEnum, IScreenshot, ITimeSlot, IUser } from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { MultiORMColumn, MultiORMEntity } from '../../core/decorators/entity';
import { TenantOrganizationBaseEntity, TimeSlot, User } from './../../core/entities/internal';
import { MikroOrmScreenshotRepository } from './repository/mikro-orm-screenshot.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

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
	@Index()
	@MultiORMColumn({ nullable: true })
	recordedAt?: Date;

	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@IsOptional()
	@IsEnum(FileStorageProviderEnum)
	@Exclude({ toPlainOnly: true })
	@Index()
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		enum: FileStorageProviderEnum
	})
	storageProvider?: FileStorageProviderEnum;

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
	@Index()
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
	@Index()
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

	/** Additional fields */
	fullUrl?: string;
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
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	timeSlotId?: ITimeSlot['id'];

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
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: IUser['id'];
}
