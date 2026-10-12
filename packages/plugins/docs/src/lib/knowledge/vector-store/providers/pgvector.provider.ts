import { Injectable, Logger } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { prepareSQLQuery as p } from '@gauzy/core';
import { TypeOrmDocumentChunkRepository } from '../../../repositories/type-orm-document-chunk.repository';
import { applyRetrievalFilters } from '../../retrieval/retrieval-filters';
import { VECTOR_STORE_PGVECTOR } from '../../knowledge.constants';
import {
	IDocumentVectorStore,
	IVectorStoreChunk,
	IVectorStoreHit,
	IVectorStoreQuery,
	IVectorStoreScope
} from '../vector-store.interface';

/**
 * The built-in pgvector store: cosine similarity over the `document_chunk.embedding`
 * `vector(1536)` column (ivfflat index, `vector_cosine_ops`), written and queried with
 * raw SQL — the entity declares the column `simple-json` so the ORM stays ignorant of the
 * vector type (§8.3).
 *
 * Availability = PostgreSQL dialect + the `vector` extension present (probed once and
 * cached; consumed by resolution and by `GET /knowledge/status`).
 */
@Injectable()
export class PgVectorStoreProvider implements IDocumentVectorStore {
	public readonly id = VECTOR_STORE_PGVECTOR;
	private readonly logger = new Logger(PgVectorStoreProvider.name);
	private availability: boolean | null = null;

	constructor(private readonly typeOrmDocumentChunkRepository: TypeOrmDocumentChunkRepository) {}

	/**
	 * @inheritdoc
	 */
	public async isAvailable(): Promise<boolean> {
		if (this.availability !== null) {
			return this.availability;
		}
		if (!isPostgres()) {
			this.availability = false;
			return false;
		}
		try {
			const rows = await this.typeOrmDocumentChunkRepository.manager.query(
				`SELECT 1 FROM pg_extension WHERE extname = 'vector'`
			);
			this.availability = Array.isArray(rows) && rows.length > 0;
		} catch (error) {
			this.logger.warn(`pgvector capability probe failed: ${(error as Error).message}`);
			this.availability = false;
		}
		if (!this.availability) {
			this.logger.log('pgvector extension not present — the platform runs lexical-only.');
		}
		return this.availability;
	}

	/** Test/ops seam: clears the cached capability probe. */
	public resetAvailabilityProbe(): void {
		this.availability = null;
	}

	/**
	 * Writes chunk embeddings with raw SQL (`UPDATE … SET embedding = $vec::vector`),
	 * tenant/org-scoped, idempotent per chunk. Chunks without an embedding are skipped.
	 */
	public async upsertChunks(scope: IVectorStoreScope, documentId: ID, chunks: IVectorStoreChunk[]): Promise<void> {
		const embedded = chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0);
		if (!embedded.length) {
			return;
		}
		const manager = this.typeOrmDocumentChunkRepository.manager;
		for (const chunk of embedded) {
			await manager.query(
				`UPDATE "document_chunk" SET "embedding" = $1::vector ` +
					`WHERE "id" = $2 AND "tenantId" = $3 AND "organizationId" = $4 AND "documentId" = $5`,
				[toVectorLiteral(chunk.embedding as number[]), chunk.chunkId, scope.tenantId, scope.organizationId, documentId]
			);
		}
	}

	/**
	 * Clears one document's vectors (the chunk rows themselves are owned by the index
	 * service's transactional replace).
	 */
	public async deleteByDocument(scope: IVectorStoreScope, documentId: ID): Promise<void> {
		await this.typeOrmDocumentChunkRepository.manager.query(
			`UPDATE "document_chunk" SET "embedding" = NULL ` +
				`WHERE "tenantId" = $1 AND "organizationId" = $2 AND "documentId" = $3`,
			[scope.tenantId, scope.organizationId, documentId]
		);
	}

	/**
	 * Cosine-distance query (`embedding <=> :vec`) under the full mandatory filter set;
	 * similarity = `1 - distance`, clamped into [0, 1].
	 */
	public async query(query: IVectorStoreQuery): Promise<IVectorStoreHit[]> {
		if (!query.embedding?.length || !(await this.isAvailable())) {
			return [];
		}

		const qb = this.typeOrmDocumentChunkRepository.createQueryBuilder('chunk');
		applyRetrievalFilters(qb, query);
		qb.andWhere(p(`"chunk"."embedding" IS NOT NULL`));
		qb.select('chunk.id', 'chunkId')
			.addSelect('chunk.documentId', 'documentId')
			.addSelect('chunk.chunkIndex', 'chunkIndex')
			.addSelect('chunk.content', 'content')
			.addSelect('chunk.metadata', 'metadata')
			.addSelect(`"chunk"."embedding" <=> :queryEmbedding`, 'distance');
		qb.setParameter('queryEmbedding', toVectorLiteral(query.embedding));
		qb.orderBy(`"chunk"."embedding" <=> :queryEmbedding`, 'ASC');
		qb.limit(query.topK);

		const rows = await qb.getRawMany();
		return rows.map((row: any) => ({
			chunkId: row.chunkId,
			documentId: row.documentId,
			chunkIndex: Number(row.chunkIndex),
			content: row.content,
			metadata: parseMetadata(row.metadata),
			score: Math.min(1, Math.max(0, 1 - Number(row.distance)))
		}));
	}
}

/**
 * Serializes a number array into the pgvector text literal (`[0.1,0.2,…]`).
 */
function toVectorLiteral(embedding: number[]): string {
	return `[${embedding.join(',')}]`;
}

/**
 * Parses the chunk metadata column, which arrives as a JSON string on some drivers.
 */
export function parseMetadata(value: unknown): any {
	if (typeof value !== 'string') {
		return value ?? undefined;
	}
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}
