import { DocsPlugin } from '@gauzy/plugin-docs';

/**
 * The plugins the WORKER process hosts.
 *
 * 🛑 This is deliberately NOT `apps/api/src/plugins.ts`. The worker exists to take the heavy,
 * long-running work off the API process (`10-implementation-plan.md` §2.6, mitigation R7), so it
 * carries only the plugins that own a queue the worker is meant to drain. Adding a plugin here
 * starts its BullMQ workers in this process — do not add one just because the API has it.
 *
 * 🛑 This module must never be imported statically from `main.ts`. `@gauzy/plugin-docs` decides
 * queue-mode vs in-process mode at MODULE-DEFINITION time (`isDocsQueueEnabled()` in
 * `docs.config.ts`, read by `docs.module.ts` when the file is first evaluated), so importing it
 * before `loadEnv()` has run would freeze that decision against an empty environment and the
 * worker would silently run every stage inline — the exact failure this process exists to avoid.
 * `main.ts` therefore reaches it through a dynamic `await import('./plugins')`.
 */
export const plugins = [
	/**
	 * Documents hub — drains the `docs-processing` queue: extract → classify → chunk → embed →
	 * index, plus thumbnails and the startup recovery scan. These stages run OCR, parse large
	 * binaries and call embedding providers, which is why they belong here and not in the API.
	 */
	DocsPlugin
];
