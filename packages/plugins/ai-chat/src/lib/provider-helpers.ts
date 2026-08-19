/**
 * The PURE provider helpers of `@gauzy/plugin-ai-chat`, without the NestJS plugin.
 *
 * The package barrel (`src/index.ts`) exports the Nest plugin/module alongside these helpers, so
 * importing `keyedCatalogue` or `transcribeViaOpenAiCompatible` through it drags in `@gauzy/core`
 * and the whole entity graph — minutes of transform in jest, and an ESM dependency jest cannot
 * load. Provider-plugin specs map `@gauzy/plugin-ai-chat` onto THIS module instead (see the
 * `moduleNameMapper` in each provider plugin's `jest.config.ts` under `packages/plugins/`): the
 * code under test is the REAL catalogue cache, the REAL fetch and the REAL speech request, not a
 * stub.
 *
 * Keep it dependency-light: nothing here may import the plugin, the module, `@gauzy/core` or the
 * `ai` SDK. Anything a provider definition needs at DEFINITION time (not inside `createModel`)
 * belongs here — `importEsm`, `BaseAiProviderPlugin` and `AiProviderRegistry` are deliberately
 * absent and read as `undefined` under this mapping, which holds only because no spec calls
 * `createModel`.
 */
export * from './model-catalogue';
export * from './speech';
