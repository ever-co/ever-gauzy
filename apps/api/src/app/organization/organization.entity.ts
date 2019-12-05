import { Column, Entity, Index } from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsDate,
	IsOptional,
	IsEnum
} from 'class-validator';
import { Base } from '../core/entities/base';
import {
	Organization as IOrganization,
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	WeekDaysEnum
} from '@gauzy/models';

@Entity('organization')
export class Organization extends Base implements IOrganization {
	@ApiModelProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiModelPropertyOptional({ type: String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiModelProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	@ApiModelPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiModelProperty({ type: String, enum: DefaultValueDateTypeEnum })
	@IsEnum(DefaultValueDateTypeEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	defaultValueDateType: string;

	@ApiModelProperty({ type: Boolean, default: true })
	@Column({ default: true })
	isActive: boolean;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	defaultAlignmentType?: string;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	timeZone?: string;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	brandColor?: string;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	dateFormat?: string;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	officialName?: string;

	@ApiModelProperty({ type: String, enum: WeekDaysEnum })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	startWeekOn?: string;

	@ApiModelProperty({ type: String, maxLength: 256 })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	taxId?: string;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	country?: string;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	city?: string;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	address?: string;

	@ApiModelProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	address2?: string;
}
