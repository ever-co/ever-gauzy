import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindManyOptions, Repository } from "typeorm";
import { IEmail, IPagination } from "@gauzy/contracts";
import { TenantAwareCrudService } from "./../core/crud";
import { Email } from "./email.entity";

@Injectable()
export class EmailHistoryService extends TenantAwareCrudService<Email> {

    constructor(
        @InjectRepository(Email)
        protected readonly emailRepository: Repository<Email>,
    ) {
        super(emailRepository);
    }

    /**
     *
     * @param filter
     * @returns
     */
    public async findAll(filter?: FindManyOptions<Email>): Promise<IPagination<IEmail>> {
        return await super.findAll({
            select: {
                user: {
                    email: true,
                    firstName: true,
                    lastName: true,
                    imageUrl: true
                }
            },
            where: filter.where,
            relations: filter.relations || [],
            order: {
                createdAt: 'DESC'
            },
            take: filter.take
        });
    }
}
