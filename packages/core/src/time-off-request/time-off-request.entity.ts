import {
	Entity,
	Column,
	JoinColumn,
	ManyToMany,
	ManyToOne,
	RelationId,
	Index
} from 'typeorm';
import {
	IEmployee,
	ITimeOff as ITimeOffRequest,
	ITimeOffPolicy,
	StatusTypesEnum,
	IImageAsset as IDocumentAsset
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsString,
	IsEnum,
	IsOptional,
	IsDate,
	IsBoolean,
	IsUUID
} from 'class-validator';
import {
	Employee,
	ImageAsset,
	TenantOrganizationBaseEntity,
	TimeOffPolicy
} from '../core/entities/internal';

@Entity('time_off_request')
export class TimeOffRequest extends TenantOrganizationBaseEntity implements ITimeOffRequest {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	documentUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column()
	start: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column()
	end: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column()
	requestDate: Date;

	@ApiProperty({ type: () => String, enum: StatusTypesEnum })
	@IsEnum(StatusTypesEnum)
	@Column()
	status?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Column({ nullable: true, default: false })
	isHoliday?: boolean;


	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	// TimeOff Policy
	@ApiProperty({ type: () => TimeOffPolicy })
	@ManyToOne(() => TimeOffPolicy, (policy) => policy.timeOffRequests, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	policy?: ITimeOffPolicy;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimeOffRequest) => it.policy)
	@Index()
	@Column()
	policyId?: string;

	/**
	 * Document Asset
	 */
	@ManyToOne(() => ImageAsset, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	document?: IDocumentAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeOffRequest) => it.document)
	@Index()
	@Column({ nullable: true })
	documentId?: IDocumentAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@ManyToMany(() => Employee, (employee) => employee.timeOffRequests, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];
}
