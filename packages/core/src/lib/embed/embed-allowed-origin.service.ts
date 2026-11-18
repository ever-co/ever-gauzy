import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { isUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { runInMikroOrmContext } from '../core/context/mikro-orm-context';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { CreateEmbedAllowedOriginDTO, EmbedAllowedOriginResponseDTO } from './dto/embed-allowed-origin.dto';
import { EmbedAllowedOrigin } from './embed-allowed-origin.entity';
import { EMBED_ORIGINS_CACHE_MS, normalizeOrigin } from './embed-origin';
import { MikroOrmEmbedAllowedOriginRepository } from './repository/mikro-orm-embed-allowed-origin.repository';
import { TypeOrmEmbedAllowedOriginRepository } from './repository/type-orm-embed-allowed-origin.repository';

/**
 * The sites allowed to embed an organization's timer. An administrator manages the list; the embed exchange accepts
 * only an origin of it and binds the token to that origin; CORS answers these origins for the timer routes.
 */
@Injectable()
export class EmbedAllowedOriginService extends TenantAwareCrudService<EmbedAllowedOrigin> {
	private readonly logger = new Logger(EmbedAllowedOriginService.name);
	// Every organization's origins, for CORS, which runs before any tenant is known.
	private everyOrigin: { origins: Set<string>; readAt: number } | null = null;

	constructor(
		readonly typeOrmEmbedAllowedOriginRepository: TypeOrmEmbedAllowedOriginRepository,
		readonly mikroOrmEmbedAllowedOriginRepository: MikroOrmEmbedAllowedOriginRepository,
		@Optional() private readonly orm?: MikroORM
	) {
		super(typeOrmEmbedAllowedOriginRepository, mikroOrmEmbedAllowedOriginRepository);
	}

	/** The organization's allowed origins, newest first. */
	async listForOrganization(organizationId: ID): Promise<EmbedAllowedOriginResponseDTO[]> {
		const rows = await this.find({
			where: { organizationId, tenantId: RequestContext.currentTenantId() },
			order: { createdAt: 'DESC' }
		});
		return rows.map((row) => EmbedAllowedOriginResponseDTO.from(row));
	}

	/** Adds an origin, normalized; adding one that is already there answers the existing row. */
	async addForOrganization(input: CreateEmbedAllowedOriginDTO): Promise<EmbedAllowedOriginResponseDTO> {
		const origin = normalizeOrigin(input.origin);
		if (!origin) {
			throw new BadRequestException(
				'An origin is a scheme, a host and an optional port, such as https://app.example.com: no path, no wildcard.'
			);
		}
		const tenantId = RequestContext.currentTenantId();
		const scope = { tenantId, organizationId: input.organizationId, origin };
		const existing = await this.find({ where: scope });
		if (existing.length > 0) {
			return EmbedAllowedOriginResponseDTO.from(existing[0]);
		}
		const row = await this.create(scope);
		this.everyOrigin = null;
		this.logger.log(`Embed origin allowed: ${origin} organizationId=${input.organizationId}`);
		return EmbedAllowedOriginResponseDTO.from(row);
	}

	/** Removes an origin of the caller's tenant. CORS stops answering it within {@link EMBED_ORIGINS_CACHE_MS}. */
	async remove(id: ID): Promise<void> {
		const row = await this.findOneByOptions({ where: { id, tenantId: RequestContext.currentTenantId() } }).catch(
			() => null
		);
		if (!row) {
			throw new NotFoundException();
		}
		await this.delete(id);
		this.everyOrigin = null;
		this.logger.log(`Embed origin removed: ${row.origin} organizationId=${row.organizationId}`);
	}

	/** Whether the organization allows this origin, read now: the exchange runs before any tenant is known. */
	async isAllowed(organizationId: ID, origin: string): Promise<boolean> {
		if (!isUUID(organizationId)) {
			return false;
		}
		const rows = await this.readAll({ organizationId, origin });
		return rows.length > 0;
	}

	/**
	 * Whether any organization allows this origin, for CORS: the list is read at most once a minute. CORS answers
	 * before Nest's middleware gives the request a MikroORM context, so under DB_ORM=mikro-orm the read opens one
	 * of its own (the global EntityManager refuses it).
	 */
	async isAllowedAnywhere(origin: string): Promise<boolean> {
		const now = Date.now();
		const fresh = this.everyOrigin && now - this.everyOrigin.readAt < EMBED_ORIGINS_CACHE_MS;
		if (!fresh) {
			const rows = await runInMikroOrmContext(this.orm, () => this.readAll({}));
			this.everyOrigin = { origins: new Set(rows.map((row) => row.origin)), readAt: now };
		}
		return this.everyOrigin.origins.has(origin);
	}

	/** Straight from the repository, with no tenant scope: neither the exchange nor CORS has one. */
	private async readAll(where: Record<string, unknown>): Promise<EmbedAllowedOrigin[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const parsed = parseTypeORMFindToMikroOrm<EmbedAllowedOrigin>({ where } as any);
				return (await this.mikroOrmEmbedAllowedOriginRepository.find(
					parsed.where,
					parsed.mikroOptions
				)) as EmbedAllowedOrigin[];
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmEmbedAllowedOriginRepository.find({ where });
			default:
				throw new Error(`ORM type not implemented: ${this.ormType}`);
		}
	}
}
