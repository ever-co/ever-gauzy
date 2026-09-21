import { DynamicModule, Module } from '@nestjs/common';
import { defineConfig, resetConfig } from '@gauzy/config';
import { Plugin } from '@gauzy/plugin';
import { GraphqlApiModule } from './graphql-api.module';
import { CORE_SCALARS } from './scalars';

/** A service the plugin's real module owns and exports, as every commerce package's does. */
class FixtureCartService {}

/** A resolver the plugin's own module does *not* declare, so the GraphQL host has to host it. */
class UnhostedResolver {}

/** A resolver the plugin's own module declares, as eleven of the sixteen packages do. */
class SelfHostedResolver {}

@Module({ providers: [FixtureCartService, SelfHostedResolver], exports: [FixtureCartService] })
class FixtureCartModule {}

@Plugin({
	imports: [FixtureCartModule],
	extensions: { resolvers: [UnhostedResolver, SelfHostedResolver] }
} as never)
class FixtureCartPlugin {}

/**
 * The resolver host is the one module that decides whether a declared GraphQL field reaches a
 * resolver at all, so these cases are about the two ways it could silently fail to: reading the
 * configuration before it exists, and declaring providers its own injector cannot satisfy.
 */
describe('GraphqlApiModule.withPlugins', () => {
	afterEach(() => {
		resetConfig();
	});

	it('reads the configuration when Nest scans it, not when the decorator is evaluated', async () => {
		// The order here is the order the real boot has: `CoreModule`'s decorator calls `withPlugins()`
		// while `@gauzy/core` is being imported, and `preBootstrapApplicationConfig` installs the
		// plugins afterwards. Reading the configuration in the body of `withPlugins()` therefore read
		// `{ plugins: [] }` on every boot, and every plugin-contributed field resolved to null.
		const definition = GraphqlApiModule.withPlugins();

		await defineConfig({ plugins: [FixtureCartPlugin] } as never);

		const composed = (await definition) as DynamicModule;

		expect(composed.providers).toContain(UnhostedResolver);
	});

	it('remembers the definition, so every compile of the import sees one module', async () => {
		const definition = GraphqlApiModule.withPlugins();

		await defineConfig({ plugins: [FixtureCartPlugin] } as never);

		expect(await definition).toBe(await definition);
	});

	it('does not declare a resolver the plugin’s own module already provides', async () => {
		const definition = GraphqlApiModule.withPlugins();

		await defineConfig({ plugins: [FixtureCartPlugin] } as never);

		const composed = (await definition) as DynamicModule;

		// Declaring it here as well would instantiate the class twice and register each of its fields
		// twice, with the second registration winning — and, before the shells re-exported anything,
		// would have failed the boot outright because this module's injector cannot see the plugin's
		// services.
		expect(composed.providers).not.toContain(SelfHostedResolver);
	});

	it('imports each plugin shell re-exporting the modules it imports', async () => {
		const definition = GraphqlApiModule.withPlugins();

		await defineConfig({ plugins: [FixtureCartPlugin] } as never);

		const composed = (await definition) as DynamicModule;
		const shell = (composed.imports ?? []).find(
			(entry) => (entry as DynamicModule)?.module === FixtureCartPlugin
		) as DynamicModule;

		expect(shell).toBeDefined();

		// Without this, a resolver hosted here that injects `FixtureCartService` cannot be constructed:
		// a module sees only what the modules it imports export, and a plugin shell that exports
		// nothing is an opaque box around the module that holds the services.
		expect(shell.exports).toContain(FixtureCartModule);
	});

	it('provides the three scalars the kernel schema declares', async () => {
		const composed = (await GraphqlApiModule.withPlugins()) as DynamicModule;

		for (const scalar of CORE_SCALARS) {
			expect(composed.providers).toContain(scalar);
		}
	});
});
