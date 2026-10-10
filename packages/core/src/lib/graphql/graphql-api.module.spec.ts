/**
 * 🛑 These two imports must stay FIRST, and in this order: it is the order the application enters the
 * graph in. Entered through the host module instead, the graph reaches a guard before its module has
 * finished evaluating (`@UseGuards()` is handed `undefined`), and then reaches `CoreModule` — whose
 * decorator calls `GraphqlApiModule.withPlugins()` — while the host module is still being defined.
 * See `channel.controller.spec.ts` for the entity half of the cycle.
 */
import '../core/entities/internal';
import '../core/core.module';

import { GraphqlApiModule } from './graphql-api.module';
import { CORE_SCALARS } from './scalars';

/**
 * The resolver host is the first module the Apollo configuration's `include` names, and a `@Scalar()`
 * class is found only as a provider of a scanned module.
 */
describe('GraphqlApiModule.withPlugins', () => {
	it('provides the three scalars the kernel schema declares', () => {
		const composed = GraphqlApiModule.withPlugins();

		for (const scalar of CORE_SCALARS) {
			expect(composed.providers).toContain(scalar);
		}
	});

	it('does not export them, because nothing injects a scalar', () => {
		const composed = GraphqlApiModule.withPlugins();

		for (const scalar of CORE_SCALARS) {
			expect(composed.exports).not.toContain(scalar);
		}
	});
});
