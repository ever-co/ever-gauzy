import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IPagination } from "@gauzy/contracts";
import { TenantAwareCrudService } from "./../../core/crud";
import { ImportHistory } from "./import-history.entity";

@Injectable()
export class ImportHistoryService extends TenantAwareCrudService<ImportHistory> {

	constructor(
		@InjectRepository(ImportHistory)
		private readonly importHistoryRepository: Repository<ImportHistory>,
	) {
		super(importHistoryRepository);
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
