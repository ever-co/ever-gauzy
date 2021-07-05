import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CrudService } from "./../../core/crud/crud.service";
import { ImportRecord } from "./../../core/entities/internal";


@Injectable()
export class ImportRecordService extends CrudService<ImportRecord> {
    
    constructor(
		@InjectRepository(ImportRecord)
		private readonly importRecordRepository: Repository<ImportRecord>,
	) {
		super(importRecordRepository);
	}
}