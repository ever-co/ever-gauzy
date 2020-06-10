import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationLanguages } from './organization-languages.entity';

@Injectable()
export class OrganizationLanguagesService extends CrudService<
	OrganizationLanguages
> {
	constructor(
		@InjectRepository(OrganizationLanguages)
		private readonly organizationLanguagesRepository: Repository<
			OrganizationLanguages
		>
	) {
		super(organizationLanguagesRepository);
	}
}
