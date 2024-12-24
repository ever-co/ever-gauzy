import {
	JoinColumn,
	RelationId
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmTimeOffRequestRepository } from './repository/mikro-orm-time-off-request.repository';

@MultiORMEntity('time_off_request', { mikroOrmRepository: () => MikroOrmTimeOffRequestRepository })
export class TimeOffRequest extends TenantOrganizationBaseEntity implements ITimeOffRequest {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	documentUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	start: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	end: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	requestDate: Date;

	@ApiProperty({ type: () => String, enum: StatusTypesEnum })
	@IsEnum(StatusTypesEnum)
	@MultiORMColumn()
	status?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	isHoliday?: boolean;


	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	// TimeOff Policy
	@ApiProperty({ type: () => TimeOffPolicy })
	@MultiORMManyToOne(() => TimeOffPolicy, (policy) => policy.timeOffRequests, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	policy?: ITimeOffPolicy;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimeOffRequest) => it.policy)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	policyId?: string;

	/**
	 * Document Asset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	documentId?: IDocumentAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToMany(() => Employee, (employee) => employee.timeOffRequests, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];
}
