import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	Index,
	JoinColumn
} from 'typeorm';
import { getConfig } from '@gauzy/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsUUID, IsNotEmpty, IsEnum, IsBoolean } from 'class-validator';
import { Exclude } from 'class-transformer';
import { FileStorageProviderEnum, IScreenshot, ITimeSlot, IUser } from '@gauzy/contracts';
import {
	TenantOrganizationBaseEntity,
	TimeSlot,
	User
} from './../../core/entities/internal';

/**
 *
 */
let options: TypeOrmModuleOptions;
try {
	options = getConfig().dbConnectionOptions
} catch (error) { }

/**
 *
 */
@Entity('screenshot')
export class Screenshot extends TenantOrganizationBaseEntity implements IScreenshot {

	@ApiProperty({ type: () => String, })
	@IsNotEmpty()
	@IsString()
	@Column()
	file: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	thumb?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	recordedAt?: Date;

	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@IsOptional()
	@IsEnum(FileStorageProviderEnum)
	@Exclude({ toPlainOnly: true })
	@Index()
	@Column({
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
	@Column({ nullable: true })
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
	@Column({ nullable: true })
	description?: string;

	/**
	 * Applications associated with the image or screenshot.
	 */
	@ApiPropertyOptional({
		type: () => ['sqlite', 'better-sqlite3'].includes(options.type) ? 'text' : 'json',
		description: 'Applications associated with the image or screenshot.'
	})
	@IsOptional()
	@IsString()
	@Column({
		nullable: true,
		type: ['sqlite', 'better-sqlite3'].includes(options.type) ? 'text' : 'json'
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
	@ManyToOne(() => TimeSlot, (it) => it.screenshots, {
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
	@Column({ nullable: true })
	timeSlotId?: ITimeSlot['id'];

	/**
	 * User
	 */
	@ManyToOne(() => User, {
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
	@Column({ nullable: true })
	userId?: IUser['id'];
}
