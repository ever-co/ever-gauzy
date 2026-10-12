import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../../core/crud';
import { RequestContext } from './../../core/context';
import { FileStorage } from './../../core/file-storage';
import { ImportHistory } from './import-history.entity';
import { TypeOrmImportHistoryRepository } from './repository/type-orm-import-history.repository';
import { MikroOrmImportHistoryRepository } from './repository/mikro-orm-import-history.repository';

@Injectable()
export class ImportHistoryService extends TenantAwareCrudService<ImportHistory> {
	constructor(
		typeOrmImportHistoryRepository: TypeOrmImportHistoryRepository,
		mikroOrmImportHistoryRepository: MikroOrmImportHistoryRepository
	) {
		super(typeOrmImportHistoryRepository, mikroOrmImportHistoryRepository);
	}

	/**
	 *
	 * @returns
	 */
	public async findAll(): Promise<IPagination<ImportHistory>> {
		try {
			return await super.findAll({
				order: {
					importDate: 'DESC'
				}
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Reads back the archive one of the current tenant's imports was made from.
	 *
	 * 🛑 The archive is a full tenant data dump. It used to be offered through `fullUrl`, a public
	 * `/public/import/import-<unix-seconds>-<0..999>.zip` URL any unauthenticated caller could guess.
	 * It is now reachable only through this method, behind the import-history route's permissions,
	 * and only for a row of the caller's OWN tenant.
	 *
	 * The tenant condition is spelled out here rather than left to `TenantAwareCrudService`, whose
	 * `findOneWithTenant()` adds nothing when there is no current user — and a request with no tenant
	 * is refused outright instead of being allowed to query with the condition missing.
	 *
	 * @param id - The import-history row.
	 * @returns The original file name and the archive's bytes.
	 * @throws ForbiddenException when the request carries no tenant.
	 * @throws NotFoundException when the row is not the tenant's, or its archive no longer exists.
	 */
	public async getArchive(id: ID): Promise<{ file: string; content: Buffer }> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new ForbiddenException();
		}

		const history = await this.findOneByIdString(id, { where: { tenantId } });
		if (!history?.path || history.tenantId !== tenantId) {
			throw new NotFoundException('The requested import archive was not found');
		}

		// The local provider logs and resolves `undefined` for a missing file; cloud providers throw.
		let content: Buffer | undefined;
		try {
			content = await new FileStorage().getProvider().getFile(history.path);
		} catch {
			content = undefined;
		}
		if (!content) {
			throw new NotFoundException('The requested import archive was not found');
		}

		return { file: history.file, content };
	}
}
