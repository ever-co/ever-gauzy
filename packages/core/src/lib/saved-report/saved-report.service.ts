import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ID, IPagination, ISavedReport, ISavedReportShareResponse, SavedReportKindEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import {
	CreateSavedReportDTO,
	MAX_SAVED_REPORTS_PER_PAGE,
	ShareSavedReportDTO,
	UpdateSavedReportDTO
} from './dto/saved-report.dto';
import { MikroOrmSavedReportRepository } from './repository/mikro-orm-saved-report.repository';
import { TypeOrmSavedReportRepository } from './repository/type-orm-saved-report.repository';
import { SavedReport } from './saved-report.entity';
import {
	isSavedReportLinkLive,
	nextSavedReportPeriodOf,
	savedReportPeriodProblemOf,
	shareExpiryProblemOf,
	SavedReportPeriodFields
} from './saved-report.rules';
import { generateSavedReportToken, hashSavedReportToken } from './saved-report-token';

/**
 * Saved reports, for their author only: nobody else lists, reads, changes, deletes or shares them through these
 * methods. Every lookup is scoped by the caller's user and, by the base service, by their tenant; a report of someone
 * else answers 404, like a report that does not exist.
 */
@Injectable()
export class SavedReportService extends TenantAwareCrudService<SavedReport> {
	private readonly logger = new Logger(SavedReportService.name);

	constructor(
		readonly typeOrmSavedReportRepository: TypeOrmSavedReportRepository,
		readonly mikroOrmSavedReportRepository: MikroOrmSavedReportRepository
	) {
		super(typeOrmSavedReportRepository, mikroOrmSavedReportRepository);
	}

	/**
	 * The caller's saved reports of one organization, newest first, a page at a time.
	 *
	 * @param organizationId The organization the reports are about.
	 * @param page How many to skip, and how many to answer (at most {@link MAX_SAVED_REPORTS_PER_PAGE}).
	 * @returns The page, and how many reports the caller has there in all.
	 */
	async listOwn(organizationId: ID, page: { skip?: number; take?: number } = {}): Promise<IPagination<ISavedReport>> {
		const authorId = this.currentUserIdOrFail();
		const where = { authorId, organizationId };
		const total = await this.count({ where });
		const rows = await this.find({
			where,
			order: { createdAt: 'DESC' },
			skip: page.skip ?? 0,
			take: Math.min(page.take ?? MAX_SAVED_REPORTS_PER_PAGE, MAX_SAVED_REPORTS_PER_PAGE)
		});
		const now = new Date();
		const items = rows.map((row) => savedReportView(row, now));
		return { items, total };
	}

	/**
	 * One of the caller's saved reports.
	 *
	 * @param id The report's id.
	 * @throws NotFoundException when it is not the caller's.
	 */
	async findOwn(id: ID): Promise<ISavedReport> {
		const row = await this.ownOrFail(id);
		return savedReportView(row, new Date());
	}

	/**
	 * Saves a report for the caller.
	 *
	 * @param input Its name, report, period, filters, grouping and whether a link shows amounts.
	 * @throws BadRequestException for a period that is neither a rule alone nor two real days in order.
	 */
	async createOwn(input: CreateSavedReportDTO): Promise<ISavedReport> {
		const authorId = this.currentUserIdOrFail();
		const period: SavedReportPeriodFields = {
			periodRule: input.periodRule ?? null,
			startDate: input.startDate ?? null,
			endDate: input.endDate ?? null
		};
		this.assertPeriod(period);

		const row = await this.create({
			authorId,
			organizationId: input.organizationId,
			name: input.name,
			kind: input.kind ?? SavedReportKindEnum.TIME_AND_ACTIVITY,
			...period,
			timeZone: input.timeZone ?? null,
			filters: input.filters ?? null,
			grouping: input.grouping ?? null,
			includeAmounts: input.includeAmounts ?? false,
			shareTokenHash: null,
			sharedAt: null,
			shareExpiresAt: null
		});

		this.logger.log(`Saved report created: id=${row.id} authorId=${authorId}`);
		return savedReportView(row, new Date());
	}

	/**
	 * Changes one of the caller's saved reports: what the update sends replaces what is stored.
	 *
	 * @param id The report's id.
	 * @param input The fields to change.
	 * @throws NotFoundException when it is not the caller's.
	 * @throws BadRequestException when the period it leaves is not a rule alone nor two real days in order.
	 */
	async updateOwn(id: ID, input: UpdateSavedReportDTO): Promise<ISavedReport> {
		const stored = await this.ownOrFail(id);
		const clearsRequiredField = input.name === null || input.kind === null || input.includeAmounts === null;
		if (clearsRequiredField) {
			throw new BadRequestException('The name, the report and the amounts choice can be changed, not cleared.');
		}
		const period = nextSavedReportPeriodOf(stored, input);
		this.assertPeriod(period);

		const sendsPeriod =
			input.periodRule !== undefined || input.startDate !== undefined || input.endDate !== undefined;
		const changes: Partial<SavedReport> = {};
		if (sendsPeriod) {
			Object.assign(changes, period);
		}
		if (input.name !== undefined) {
			changes.name = input.name;
		}
		if (input.kind !== undefined) {
			changes.kind = input.kind;
		}
		if (input.timeZone !== undefined) {
			changes.timeZone = input.timeZone;
		}
		if (input.filters !== undefined) {
			changes.filters = input.filters;
		}
		if (input.grouping !== undefined) {
			changes.grouping = input.grouping;
		}
		if (input.includeAmounts !== undefined) {
			changes.includeAmounts = input.includeAmounts;
		}

		await this.update({ id, authorId: stored.authorId }, changes);
		return savedReportView({ ...stored, ...changes } as SavedReport, new Date());
	}

	/**
	 * Deletes one of the caller's saved reports, and with it its link.
	 *
	 * @param id The report's id.
	 * @throws NotFoundException when it is not the caller's.
	 */
	async deleteOwn(id: ID): Promise<void> {
		const stored = await this.ownOrFail(id);
		await this.delete({ id, authorId: stored.authorId });
		this.logger.log(`Saved report deleted: id=${id}`);
	}

	/**
	 * Turns a link on for one of the caller's reports, or replaces the one it has: a new token, whose digest replaces the
	 * stored one, so the previous link stops working at once.
	 *
	 * @param id The report's id.
	 * @param input When the link stops working, if it should.
	 * @returns The token, this one time. Only its digest is stored.
	 */
	async shareOwn(id: ID, input: ShareSavedReportDTO): Promise<ISavedReportShareResponse> {
		const stored = await this.ownOrFail(id);
		const now = new Date();
		const expiryProblem = shareExpiryProblemOf(input?.expiresAt, now);
		if (expiryProblem) {
			throw new BadRequestException(expiryProblem);
		}

		const token = generateSavedReportToken();
		const shareExpiresAt = expiryDateOf(input?.expiresAt);
		await this.update(
			{ id, authorId: stored.authorId },
			{ shareTokenHash: hashSavedReportToken(token), sharedAt: now, shareExpiresAt }
		);

		this.logger.log(`Saved report link turned on: id=${id}`);
		return { token, sharedAt: now, shareExpiresAt };
	}

	/**
	 * Turns the link of one of the caller's reports off: the stored digest is cleared, so the link stops working at once.
	 *
	 * @param id The report's id.
	 */
	async unshareOwn(id: ID): Promise<void> {
		const stored = await this.ownOrFail(id);
		await this.update(
			{ id, authorId: stored.authorId },
			{ shareTokenHash: null, sharedAt: null, shareExpiresAt: null }
		);
		this.logger.log(`Saved report link turned off: id=${id}`);
	}

	/** The caller's report, or 404 for a report that is not theirs or does not exist. */
	private async ownOrFail(id: ID): Promise<SavedReport> {
		const authorId = this.currentUserIdOrFail();
		const [row] = await this.find({ where: { id, authorId } });
		if (!row) {
			throw new NotFoundException();
		}
		return row;
	}

	private assertPeriod(period: SavedReportPeriodFields): void {
		const problem = savedReportPeriodProblemOf(period);
		if (problem) {
			throw new BadRequestException(problem);
		}
	}

	private currentUserIdOrFail(): ID {
		const userId = RequestContext.currentUserId();
		if (!userId) {
			throw new UnauthorizedException();
		}
		return userId;
	}
}

/** The end of a link as stored: the date sent, or none. */
function expiryDateOf(expiresAt: string | null | undefined): Date | null {
	if (!expiresAt) {
		return null;
	}
	return new Date(expiresAt);
}

/**
 * A report as its author reads it: everything but the digest of its link, with whether the link works now.
 *
 * @param row The stored report.
 * @param now The moment of the read.
 */
export function savedReportView(row: SavedReport, now: Date): ISavedReport {
	const isShared = isSavedReportLinkLive(row, now);
	return {
		id: row.id,
		tenantId: row.tenantId,
		organizationId: row.organizationId,
		authorId: row.authorId,
		name: row.name,
		kind: row.kind,
		periodRule: row.periodRule ?? null,
		startDate: row.startDate ?? null,
		endDate: row.endDate ?? null,
		timeZone: row.timeZone ?? null,
		filters: row.filters ?? null,
		grouping: row.grouping ?? null,
		includeAmounts: row.includeAmounts ?? false,
		sharedAt: row.sharedAt ?? null,
		shareExpiresAt: row.shareExpiresAt ?? null,
		isShared,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}
