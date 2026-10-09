import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { CrudService } from '../core/crud';
import { ReportCategory } from './report-category.entity';
import { TypeOrmReportCategoryRepository } from './repository/type-orm-report-category.repository';
import { MikroOrmReportCategoryRepository } from './repository/mikro-orm-report-category.repository';

/** The members a caller may state when it files or edits a category of the report catalogue. */
export interface IReportCategoryInput {
	name?: string;
	iconClass?: string;
}

/** The longest text any member of a catalogue row may hold: the columns are plain `varchar`s. */
export const REPORT_CATALOGUE_TEXT_MAX = 255;

@Injectable()
export class ReportCategoryService extends CrudService<ReportCategory> {
	constructor(
		typeOrmReportCategoryRepository: TypeOrmReportCategoryRepository,
		mikroOrmReportCategoryRepository: MikroOrmReportCategoryRepository
	) {
		super(typeOrmReportCategoryRepository, mikroOrmReportCategoryRepository);
	}

	/**
	 * Files one heading of the platform-wide report catalogue.
	 *
	 * The catalogue has no tenant: the row is offered to every tenant, which is why both routes that reach
	 * this are gated to `SUPER_ADMIN`. The members are checked here rather than by a DTO alone, because the
	 * GraphQL input reaches this method without one.
	 *
	 * @param input The name, and optionally the icon.
	 * @returns The category.
	 */
	async createCategory(input: IReportCategoryInput): Promise<ReportCategory> {
		const name = this.requiredText(input?.name, 'name');

		return await this.create({ name, iconClass: this.optionalText(input?.iconClass, 'iconClass') });
	}

	/**
	 * Edits one heading of the catalogue. A member left out is left as it is.
	 *
	 * @param id The category.
	 * @param input The members to change.
	 * @returns The category as it now stands.
	 * @throws NotFoundException when there is no such category.
	 */
	async updateCategory(id: ID, input: IReportCategoryInput): Promise<ReportCategory> {
		await this.findOneByIdString(id);

		const changes: Partial<ReportCategory> = {};

		if (input?.name !== undefined) {
			changes.name = this.requiredText(input.name, 'name');
		}

		if (input?.iconClass !== undefined) {
			changes.iconClass = this.optionalText(input.iconClass, 'iconClass');
		}

		if (Object.keys(changes).length > 0) {
			await this.update(id, changes);
		}

		return await this.findOneByIdString(id);
	}

	/**
	 * Withdraws one heading of the catalogue — a soft delete, so the row can be recovered and the seeded
	 * reports that were filed under it never lose their category.
	 *
	 * A category that still files a live report is refused rather than withdrawn: withdrawing it would leave
	 * every organization's report list with entries whose heading has gone. Move or withdraw the reports
	 * first.
	 *
	 * @param id The category.
	 * @returns `true` when the category was withdrawn, `false` when there was no such live category.
	 * @throws ConflictException when a live report is still filed under it.
	 */
	async withdrawCategory(id: ID): Promise<boolean> {
		let category: ReportCategory;

		try {
			category = await this.findOneByIdString(id, { relations: { reports: true } });
		} catch (error) {
			if (error instanceof NotFoundException) {
				return false;
			}

			throw error;
		}

		const reports = category.reports ?? [];

		if (reports.length > 0) {
			throw new ConflictException(
				`REPORT_CATEGORY_IN_USE: ${reports.length} report(s) are still filed under this category.`
			);
		}

		await this.softRemove(id);

		return true;
	}

	/** A member that must be stated: trimmed, non-empty, within the column's length. */
	private requiredText(value: unknown, member: string): string {
		const text = typeof value === 'string' ? value.trim() : '';

		if (!text || text.length > REPORT_CATALOGUE_TEXT_MAX) {
			throw new BadRequestException(`${member} must be 1 to ${REPORT_CATALOGUE_TEXT_MAX} characters.`);
		}

		return text;
	}

	/** A member that may be absent: when stated, a string within the column's length. */
	private optionalText(value: unknown, member: string): string | undefined {
		if (value === undefined || value === null) {
			return undefined;
		}

		if (typeof value !== 'string' || value.length > REPORT_CATALOGUE_TEXT_MAX) {
			throw new BadRequestException(`${member} must be at most ${REPORT_CATALOGUE_TEXT_MAX} characters.`);
		}

		return value;
	}
}
