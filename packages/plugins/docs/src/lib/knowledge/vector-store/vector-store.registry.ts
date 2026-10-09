import { Logger } from '@nestjs/common';
import { getDocsConfig } from '../../docs.config';
import { IDocumentVectorStore } from './vector-store.interface';

/**
 * DocumentVectorStoreRegistry
 *
 * Process-wide registry of vector-store providers, mirroring the AI-chat plugin's
 * `AiProviderRegistry` composition style: a static registry (not Nest DI) so third-party
 * store plugins register without importing this plugin's Nest graph.
 *
 * Resolution order:
 * 1. `GAUZY_DOCS_VECTOR_STORE` pin — when set, that provider is used if available
 *    (an unavailable pinned provider logs a warning and falls through);
 * 2. registration order, first available provider wins (the plugin registers `pgvector`
 *    before `lexical`, and `lexical` is always available — resolution never fails).
 */
export class DocumentVectorStoreRegistry {
	private static readonly logger = new Logger('DocumentVectorStoreRegistry');
	private static readonly stores = new Map<string, IDocumentVectorStore>();

	/** Registers (or replaces) a store provider. */
	static register(store: IDocumentVectorStore): void {
		if (this.stores.has(store.id)) {
			this.logger.warn(`Vector store '${store.id}' was already registered — replacing.`);
		}
		this.stores.set(store.id, store);
		this.logger.log(`Vector store registered: ${store.id}`);
	}

	/** Removes a store provider (plugin teardown). */
	static unregister(id: string): void {
		this.stores.delete(id);
	}

	static get(id: string): IDocumentVectorStore | undefined {
		return this.stores.get(id);
	}

	/** All registered stores in registration order. */
	static list(): IDocumentVectorStore[] {
		return [...this.stores.values()];
	}

	static clear(): void {
		this.stores.clear();
	}

	/**
	 * Resolves the active store: the `GAUZY_DOCS_VECTOR_STORE` pin when set and available,
	 * else the first available registered store.
	 *
	 * @returns The resolved store, or `null` when nothing is registered/available.
	 */
	static async resolve(): Promise<IDocumentVectorStore | null> {
		const pinned = getDocsConfig().vectorStore;
		if (pinned) {
			const store = this.stores.get(pinned);
			if (store && (await this.safeIsAvailable(store))) {
				return store;
			}
			this.logger.warn(
				`Pinned vector store '${pinned}' is ${store ? 'not available' : 'not registered'} — falling back.`
			);
		}
		for (const store of this.stores.values()) {
			if (await this.safeIsAvailable(store)) {
				return store;
			}
		}
		return null;
	}

	/** An availability probe must never throw the resolution over. */
	private static async safeIsAvailable(store: IDocumentVectorStore): Promise<boolean> {
		try {
			return await store.isAvailable();
		} catch (error) {
			this.logger.warn(`Vector store '${store.id}' availability probe failed: ${(error as Error).message}`);
			return false;
		}
	}
}
