import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToMany,
	JoinTable,
	OneToMany
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsDate,
	IsOptional,
	IsEnum,
	IsNumber,
	Min,
	Max,
	IsBoolean
} from 'class-validator';
import {
	Organization as IOrganization,
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	WeekDaysEnum,
	BonusTypeEnum
} from '@gauzy/models';
import { Tag } from '../tags/tag.entity';
import { Skill } from '../skills/skill.entity';
import { Invoice } from '../invoice/invoice.entity';
import { TenantLocationBase } from '../core/entities/tenant-location-base';

@Entity('organization')
export class Organization extends TenantLocationBase implements IOrganization {
	@ApiProperty()
	@ManyToMany((type) => Tag)
	@JoinTable({
		name: 'tag_organizations'
	})
	tags: Tag[];

	@ApiPropertyOptional({ type: Invoice, isArray: true })
	@OneToMany((type) => Invoice, (invoices) => invoices.fromOrganization)
	@JoinColumn()
	invoices?: Invoice[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String, minLength: 3, maxLength: 100 })
	@IsString()
	@Index({ unique: true })
	@IsOptional()
	@Column({ nullable: true })
	profile_link: string;

	@ApiProperty({ type: String, maxLength: 300 })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	banner: string;

	@ApiProperty({ type: String, maxLength: 4 })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	size: string;

	@ApiProperty({ type: String, maxLength: 600 })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	short_description: string;

	@ApiProperty({ type: String })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	client_focus: string;

	@ApiProperty({ type: String })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	overview: string;

	@ApiProperty({ type: String, maxLength: 4 })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	founded: string;

	@ApiPropertyOptional({ type: String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiProperty({ type: String, enum: DefaultValueDateTypeEnum })
	@IsEnum(DefaultValueDateTypeEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	defaultValueDateType: string;

	@ApiProperty({ type: Boolean, default: true })
	@Column({ default: true })
	isActive: boolean;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	defaultAlignmentType?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	timeZone?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	brandColor?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	dateFormat?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	officialName?: string;

	@ApiProperty({ type: String, enum: WeekDaysEnum })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	startWeekOn?: string;

	@ApiProperty({ type: String, maxLength: 256 })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	taxId?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	numberFormat?: string;

	@ApiProperty({ type: String, enum: BonusTypeEnum })
	@IsEnum(BonusTypeEnum)
	@Column({ nullable: true })
	bonusType?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Min(0)
	@Max(100)
	@Column({ nullable: true })
	bonusPercentage?: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	invitesAllowed?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_income?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_profits?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_business_paid?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_total_hours?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_minimum_project_size?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_projects_count?: boolean;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	inviteExpiryPeriod?: number;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	@IsOptional()
	@IsDate()
	fiscalStartDate?: Date;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	@IsOptional()
	@IsDate()
	fiscalEndDate?: Date;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	@IsOptional()
	@IsDate()
	registrationDate?: Date;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	futureDateAllowed?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: true })
	allowManualTime?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: true })
	allowModifyTime?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: true })
	allowDeleteTime?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: true })
	requireReason?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: true })
	requireDescription?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: true })
	requireProject?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: true })
	requireTask?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: true })
	requireClient?: boolean;

	@ApiProperty({ enum: [12, 24] })
	@IsBoolean()
	@Column({ default: 12 })
	timeFormat?: 12 | 24;

	@ApiProperty({ type: Skill })
	@ManyToMany((type) => Skill)
	@JoinTable({
		name: 'skill_organization'
	})
	skills: Skill[];

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	organizationId?: string;
}
