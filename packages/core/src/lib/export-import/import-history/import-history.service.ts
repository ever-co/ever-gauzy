import { BadRequestException, Injectable } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../../core/crud';
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
}
