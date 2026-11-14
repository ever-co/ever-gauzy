import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import {
	ID,
	ISavedReport,
	ISavedReportFilters,
	IUser,
	SavedReportGroupingEnum,
	SavedReportKindEnum,
	SavedReportPeriodRuleEnum
} from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ExportRedacted } from '../export-import/export-redact.decorator';
import { MikroOrmSavedReportRepository } from './repository/mikro-orm-saved-report.repository';

/**
 * A report a member saved: which report, its period (a rule such as "last month", or fixed days), its filters and its
 * grouping. Only its author reads, changes or shares it.
 *
 * A link, when its author turns one on, is a random token: only its SHA-256 digest is stored, so a copy of the database
 * opens no report. Turning the link off clears the digest, and replacing it stores another one, so the old link stops
 * working at once.
 */
@MultiORMEntity('saved_report', { mikroOrmRepository: () => MikroOrmSavedReportRepository })
export class SavedReport extends TenantOrganizationBaseEntity implements ISavedReport {
	@ApiProperty({ type: () => String, maxLength: 100 })
	@MultiORMColumn({ length: 100 })
	name: string;

	@ApiProperty({ type: () => String, enum: SavedReportKindEnum })
	@MultiORMColumn({ default: SavedReportKindEnum.TIME_AND_ACTIVITY })
	kind: SavedReportKindEnum;

	@ApiPropertyOptional({ type: () => String, enum: SavedReportPeriodRuleEnum })
	@MultiORMColumn({ nullable: true })
	periodRule?: SavedReportPeriodRuleEnum | null;

	/** The first day of fixed dates, `YYYY-MM-DD`: a day, not an instant, so it means the same in every zone. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true, length: 10 })
	startDate?: string | null;

	/** The last day of fixed dates, included, `YYYY-MM-DD`. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true, length: 10 })
	endDate?: string | null;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	timeZone?: string | null;

	@ApiPropertyOptional({ type: () => Object })
	@JsonColumn({ nullable: true })
	filters?: ISavedReportFilters | null;

	@ApiPropertyOptional({ type: () => String, enum: SavedReportGroupingEnum })
	@MultiORMColumn({ nullable: true })
	grouping?: SavedReportGroupingEnum | null;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@MultiORMColumn({ default: false })
	includeAmounts?: boolean;

	/** The SHA-256 digest of the link's token; null while no link is on. Never serialized, never exported. */
	@ExportRedacted({ blank: true })
	@Exclude({ toPlainOnly: true })
	@ColumnIndex({ unique: true })
	@MultiORMColumn({ nullable: true, length: 64 })
	shareTokenHash?: string | null;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	sharedAt?: Date | null;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	shareExpiresAt?: Date | null;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The user who saved it. Their reports go with them. */
	@MultiORMManyToOne(() => User, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	author?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: SavedReport) => it.author)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	authorId: ID;
}
