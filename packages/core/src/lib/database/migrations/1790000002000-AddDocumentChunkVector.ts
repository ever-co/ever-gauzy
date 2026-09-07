import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddDocumentChunkVector1790000002000 implements MigrationInterface {
    name = 'AddDocumentChunkVector1790000002000';

    /**
     * Up Migration
     *
     * PostgreSQL only: converts "document_chunk"."embedding" from text to vector(1536)
     * (pgvector) and adds the ivfflat similarity index, plus the GIN full-text index on
     * "content" used by the lexical retrieval fallback. The pgvector part is guarded —
     * when the extension is unavailable (no superuser, managed instance without pgvector)
     * it logs a warning and leaves the column as text so boot is never blocked; the GIN
     * full-text index does not depend on the extension and is created either way.
     * MySQL and SQLite are explicit no-ops (the "embedding" column stays text).
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' start running!'));

        switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
            case DatabaseTypeEnum.sqlite:
            case DatabaseTypeEnum.betterSqlite3:
                console.log(chalk.yellow(this.name + ' is a no-op for sqlite (embedding stays text)'));
                break;
            case DatabaseTypeEnum.postgres:
                await this.postgresUpQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                console.log(chalk.yellow(this.name + ' is a no-op for mysql (embedding stays text)'));
                break;
            default:
                throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    }

    /**
     * Down Migration
     *
     * @param queryRunner
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' reverting changes!'));

        switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
            case DatabaseTypeEnum.sqlite:
            case DatabaseTypeEnum.betterSqlite3:
                console.log(chalk.yellow(this.name + ' is a no-op for sqlite'));
                break;
            case DatabaseTypeEnum.postgres:
                await this.postgresDownQueryRunner(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                console.log(chalk.yellow(this.name + ' is a no-op for mysql'));
                break;
            default:
                throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    }

    /**
    * PostgresDB Up Migration
    *
    * @param queryRunner
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        // Guarded pgvector conversion — migrations run inside a transaction ({ transaction: 'each' }),
        // so a savepoint lets the failed vector branch roll back without aborting the whole migration.
        await queryRunner.query(`SAVEPOINT document_chunk_vector`);
        try {
            await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
            // USING NULL discards pre-conversion text embeddings — harmless: the column is empty at
            // this point (this migration runs right after the tables are created) and any stragglers
            // are repopulated by the normal re-index path.
            await queryRunner.query(`ALTER TABLE "document_chunk" ALTER COLUMN "embedding" TYPE vector(1536) USING NULL`);
            await queryRunner.query(`CREATE INDEX "IDX_document_chunk_embedding" ON "document_chunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)`);
            await queryRunner.query(`RELEASE SAVEPOINT document_chunk_vector`);
        } catch (error) {
            await queryRunner.query(`ROLLBACK TO SAVEPOINT document_chunk_vector`);
            console.log(
                chalk.yellow(
                    `pgvector extension unavailable — "document_chunk"."embedding" stays text and retrieval degrades to lexical-only: ${error}`
                )
            );
        }
        // Full-text index for the lexical retrieval leg — created even when pgvector is unavailable.
        await queryRunner.query(`CREATE INDEX "IDX_document_chunk_content_fts" ON "document_chunk" USING GIN (to_tsvector('simple', "content"))`);
    }

    /**
    * PostgresDB Down Migration
    *
    * Drops both indexes and converts the column back to text. Never drops the extension.
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_document_chunk_content_fts"`);
        await queryRunner.query(`SAVEPOINT document_chunk_vector_down`);
        try {
            await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_document_chunk_embedding"`);
            await queryRunner.query(`ALTER TABLE "document_chunk" ALTER COLUMN "embedding" TYPE text USING NULL`);
            await queryRunner.query(`RELEASE SAVEPOINT document_chunk_vector_down`);
        } catch (error) {
            await queryRunner.query(`ROLLBACK TO SAVEPOINT document_chunk_vector_down`);
            console.log(chalk.yellow(`Error while reverting the pgvector embedding column (was it ever converted?): ${error}`));
        }
    }
}
