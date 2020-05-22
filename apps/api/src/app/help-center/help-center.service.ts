// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { CrudService } from '../core/crud/crud.service';

// @Injectable()
// export class HelpCenterMenuService extends CrudService<HelpCenterMenu> {
// 	constructor(
// 		@InjectRepository(HelpCenterMenu)
// 		private readonly HelpCenterMenuRepository: Repository<HelpCenterMenu>
// 	) {
// 		super(HelpCenterMenuRepository);
// 	}
// 	async findByCandidateId(id: string): Promise<HelpCenterMenu[]> {
// 		return await this.repository
// 			.createQueryBuilder('help-center-menu')
// 			.where('help-center-menu.id = :id', {
// 				id,
// 			})
// 			.getMany();
// 	}
// }
