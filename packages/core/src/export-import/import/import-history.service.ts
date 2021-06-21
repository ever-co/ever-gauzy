import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CrudService } from "./../../core/crud/crud.service";
import { ImportHistory } from "./../../core/entities/internal";


@Injectable()
export class ImportHistoryService extends CrudService<ImportHistory> {
    
    constructor(
		@InjectRepository(ImportHistory)
		private readonly importHistoryRepository: Repository<ImportHistory>,
	) {
		super(importHistoryRepository);
	}
}