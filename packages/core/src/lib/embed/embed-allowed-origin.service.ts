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

/** The length of `embed_allowed_origin.origin`. Normalizing can lengthen a value: a domain name is stored in punycode. */
const ORIGIN_MAX_LENGTH = 255;

/**
 * The sites allowed to embed an organization's timer. An administrator manages the list; the embed exchange accepts
 * only an origin of it and binds the token to that origin; CORS answers these origins for the timer routes.
 */
@Injectable()
export class EmbedAllowedOriginService extends TenantAwareCrudService<EmbedAllowedOrigin> {
	private readonly logger = new Logger(EmbedAllowedOriginService.name);
	// Every organization's origins, for CORS, which runs before any tenant is known.
	private everyOrigin: { origins: Set<string>; readAt: number } | null = null;
	// Counts the adds and removals on this server, so a read of every origin that one of them overtook is not kept.
	private originsGeneration = 0;
	// The read of every origin in flight, shared by the CORS answers that wait for it, for the generation it began in.
	private everyOriginRead: { generation: number; read: Promise<Set<string>> } | null = null;

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
		if (origin.length > ORIGIN_MAX_LENGTH) {
			throw new BadRequestException(
				`An origin is at most ${ORIGIN_MAX_LENGTH} characters as stored (an international domain name in punycode).`
			);
		}
		const tenantId = RequestContext.currentTenantId();
		const scope = { tenantId, organizationId: input.organizationId, origin };
		const existing = await this.find({ where: scope });
		if (existing.length > 0) {
			return EmbedAllowedOriginResponseDTO.from(existing[0]);
		}
		let row: EmbedAllowedOrigin;
		try {
			// Who added it, stated: under MikroORM `createdByUserId` is a mirror that is not persisted, and the base
			// subscriber sets only the mirror; the create states the creator relation from it. TypeORM writes the same
			// value either way.
			row = await this.create({ ...scope, createdByUserId: RequestContext.currentUserId() });
		} catch (error) {
			// Two requests adding the same origin at once: the unique index refuses the second insert, and the row
			// the first one saved is the answer.
			const saved = await this.find({ where: scope }).catch(() => []);
			if (saved.length > 0) {
				return EmbedAllowedOriginResponseDTO.from(saved[0]);
			}
			throw error;
		}
		this.forgetEveryOrigin();
		this.logger.log(`Embed origin allowed: ${origin} organizationId=${input.organizationId}`);
		return EmbedAllowedOriginResponseDTO.from(row);
	}

	/**
	 * Removes an origin of the caller's tenant. The organization's next exchange refuses it at once; CORS stops answering
	 * it within {@link EMBED_ORIGINS_CACHE_MS}, unless another organization or ALLOWED_ORIGINS still allows it. Only a
	 * miss answers 404: a lookup that failed is thrown as it is, so the caller knows nothing was removed.
	 */
	async remove(id: ID): Promise<void> {
		const row = await this.findOneByOptions({ where: { id, tenantId: RequestContext.currentTenantId() } }).catch(
			(error) => {
				if (error instanceof NotFoundException) {
					return null;
				}
				throw error;
			}
		);
		if (!row) {
			throw new NotFoundException();
		}
		await this.delete(id);
		this.forgetEveryOrigin();
		this.logger.log(`Embed origin removed: ${row.origin} organizationId=${row.organizationId}`);
	}

	/**
	 * Whether the organization allows this origin, read now: the exchange runs before any tenant is known, so the
	 * credential's tenant is passed. Only a row of that tenant counts: an organization id is not a secret, and a row
	 * another tenant wrote naming it must not widen the organization's list.
	 */
	async isAllowed(tenantId: ID, organizationId: ID, origin: string): Promise<boolean> {
		if (!isUUID(tenantId) || !isUUID(organizationId)) {
			return false;
		}
		const rows = await this.readAll({ tenantId, organizationId, origin });
		return rows.length > 0;
	}

	/**
	 * Whether any organization allows this origin, for CORS: the list is read at most once a minute. CORS answers
	 * before Nest's middleware gives the request a MikroORM context, so under DB_ORM=mikro-orm the read opens one
	 * of its own (the global EntityManager refuses it).
	 */
	async isAllowedAnywhere(origin: string): Promise<boolean> {
		const fresh = this.everyOrigin && Date.now() - this.everyOrigin.readAt < EMBED_ORIGINS_CACHE_MS;
		if (fresh) {
			return this.everyOrigin.origins.has(origin);
		}
		return (await this.readEveryOrigin()).has(origin);
	}

	/**
	 * Every origin, read once for all the CORS answers that ask while the read runs. A read that an add or a removal on
	 * this server overtook answers those who waited for it, and is neither kept nor shared any more: the list may
	 * predate the change, so the next request reads again. A failed read is forgotten, so the next request retries.
	 */
	private readEveryOrigin(): Promise<Set<string>> {
		const generation = this.originsGeneration;
		if (this.everyOriginRead?.generation === generation) {
			return this.everyOriginRead.read;
		}
		const startedAt = Date.now();
		const read = runInMikroOrmContext(this.orm, () => this.readAll({}))
			.then((rows) => {
				const origins = new Set(rows.map((row) => row.origin));
				if (generation === this.originsGeneration) {
					this.everyOrigin = { origins, readAt: startedAt };
				}
				return origins;
			})
			.finally(() => {
				if (this.everyOriginRead?.read === read) {
					this.everyOriginRead = null;
				}
			});
		this.everyOriginRead = { generation, read };
		return read;
	}

	/** After an add or a removal on this server: the next CORS answer reads every origin again. */
	private forgetEveryOrigin(): void {
		this.everyOrigin = null;
		this.originsGeneration++;
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
