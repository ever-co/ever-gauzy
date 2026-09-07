import { Injectable, Logger } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { prepareSQLQuery as p } from '@gauzy/core';
import { TypeOrmDocumentChunkRepository } from '../../../repositories/type-orm-document-chunk.repository';
import { VECTOR_STORE_LEXICAL } from '../../knowledge.constants';
import { applyRetrievalFilters } from '../../retrieval/retrieval-filters';
import { parseMetadata } from './pgvector.provider';
import {
	IDocumentVectorStore,
	IVectorStoreChunk,
	IVectorStoreHit,
	IVectorStoreQuery,
	IVectorStoreScope
} from '../vector-store.interface';

/** Maximum query terms considered on the ILIKE/LIKE fallback path. */
const MAX_QUERY_TERMS = 12;

/**
 * The always-available lexical store (the retrieval degradation floor, §9.3/§10).
 *
 * - PostgreSQL: `websearch_to_tsquery('simple', :q)` against the GIN expression index
 *   (`to_tsvector('simple', content)`), ranked by `ts_rank_cd`. When the parsed tsquery is
 *   empty (stop-words-only or a < 3-char query), fall back to an ILIKE OR-list over up to
 *   12 query terms, ranked by matched-term count.
 * - MySQL / SQLite: the LIKE variant only.
 *
 * `upsertChunks`/`deleteByDocument` are no-ops — the `document_chunk` rows ARE this store.
 */
@Injectable()
export class LexicalStoreProvider implements IDocumentVectorStore {
	public readonly id = VECTOR_STORE_LEXICAL;
	private readonly logger = new Logger(LexicalStoreProvider.name);

	constructor(private readonly typeOrmDocumentChunkRepository: TypeOrmDocumentChunkRepository) {}

	/**
	 * @inheritdoc — the lexical store is the floor of the ladder: always available.
	 */
	public async isAvailable(): Promise<boolean> {
		return true;
	}

	/** No-op: chunk rows are written by the index service. */
	public async upsertChunks(_scope: IVectorStoreScope, _documentId: ID, _chunks: IVectorStoreChunk[]): Promise<void> {
		// The database rows are the store.
	}

	/** No-op: chunk rows are removed by the index service. */
	public async deleteByDocument(_scope: IVectorStoreScope, _documentId: ID): Promise<void> {
		// The database rows are the store.
	}

	/**
	 * @inheritdoc
	 */
	public async query(query: IVectorStoreQuery): Promise<IVectorStoreHit[]> {
		const text = (query.text ?? '').trim();
		if (!text) {
			return [];
		}

		if (isPostgres() && text.length >= 3) {
			try {
				if (await this.tsQueryParses(text)) {
					return await this.fullTextQuery(query, text);
				}
			} catch (error) {
				this.logger.debug(`tsquery leg failed — falling back to ILIKE: ${(error as Error).message}`);
			}
		}
		return this.likeQuery(query, text);
	}

	/**
	 * True when `websearch_to_tsquery('simple', text)` parses to a non-empty query.
	 */
	private async tsQueryParses(text: string): Promise<boolean> {
		const rows = await this.typeOrmDocumentChunkRepository.manager.query(
			`SELECT websearch_to_tsquery('simple', $1)::text AS q`,
			[text]
		);
		return Boolean(rows?.[0]?.q && String(rows[0].q).trim().length);
	}

	/**
	 * PostgreSQL full-text leg: GIN-indexed tsvector match ranked by `ts_rank_cd`
	 * (clamped into [0, 1]).
	 */
	private async fullTextQuery(query: IVectorStoreQuery, text: string): Promise<IVectorStoreHit[]> {
		const qb = this.typeOrmDocumentChunkRepository.createQueryBuilder('chunk');
		applyRetrievalFilters(qb, query);
		qb.andWhere(`to_tsvector('simple', "chunk"."content") @@ websearch_to_tsquery('simple', :ftsQuery)`, {
			ftsQuery: text
		});
		qb.select('chunk.id', 'chunkId')
			.addSelect('chunk.documentId', 'documentId')
			.addSelect('chunk.chunkIndex', 'chunkIndex')
			.addSelect('chunk.content', 'content')
			.addSelect('chunk.metadata', 'metadata')
			.addSelect(
				`ts_rank_cd(to_tsvector('simple', "chunk"."content"), websearch_to_tsquery('simple', :ftsQuery))`,
				'rank'
			);
		qb.orderBy('rank', 'DESC');
		qb.limit(query.topK);

		const rows = await qb.getRawMany();
		return rows.map((row: any) => this.toHit(row, Math.min(1, Math.max(0, Number(row.rank)))));
	}

	/**
	 * The ILIKE/LIKE floor: an OR-list over up to 12 terms, ranked by matched-term
	 * fraction (score = matched / total ∈ [0, 1]).
	 */
	private async likeQuery(query: IVectorStoreQuery, text: string): Promise<IVectorStoreHit[]> {
		const terms = [...new Set(text.toLowerCase().split(/\s+/).filter(Boolean))].slice(0, MAX_QUERY_TERMS);
		if (!terms.length) {
			return [];
		}

		const qb = this.typeOrmDocumentChunkRepository.createQueryBuilder('chunk');
		applyRetrievalFilters(qb, query);

		const likeClauses: string[] = [];
		const caseClauses: string[] = [];
		terms.forEach((term, index) => {
			const param = `likeTerm${index}`;
			likeClauses.push(p(`LOWER("chunk"."content") LIKE :${param}`));
			caseClauses.push(p(`(CASE WHEN LOWER("chunk"."content") LIKE :${param} THEN 1 ELSE 0 END)`));
			qb.setParameter(param, `%${term}%`);
		});
		qb.andWhere(`(${likeClauses.join(' OR ')})`);

		qb.select('chunk.id', 'chunkId')
			.addSelect('chunk.documentId', 'documentId')
			.addSelect('chunk.chunkIndex', 'chunkIndex')
			.addSelect('chunk.content', 'content')
			.addSelect('chunk.metadata', 'metadata')
			.addSelect(caseClauses.join(' + '), 'matched');
		qb.orderBy('matched', 'DESC');
		qb.limit(query.topK);

		const rows = await qb.getRawMany();
		return rows.map((row: any) => this.toHit(row, Math.min(1, Math.max(0, Number(row.matched) / terms.length))));
	}

	private toHit(row: any, score: number): IVectorStoreHit {
		return {
			chunkId: row.chunkId,
			documentId: row.documentId,
			chunkIndex: Number(row.chunkIndex),
			content: row.content,
			metadata: parseMetadata(row.metadata),
			score
		};
	}
}
