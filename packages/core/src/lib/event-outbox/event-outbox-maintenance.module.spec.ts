/**
 * The wiring that lets the dispatch pass exist at all.
 *
 * A scheduler registration instantiates its job providers in the scheduler's own injector, not in the
 * injector of the module that owns the services those providers inject — and a module's imports are
 * not inherited by the module that imports it. So the registration has to carry the kernel's module
 * itself, and the failure mode when it does not is a boot that dies on an unresolved dependency with
 * a message about a provider rather than about a missing import.
 *
 * What is asserted here is therefore the shape of the registration rather than anything the worker
 * does: that both halves are declared, that the services they inject travel with them, and that the
 * kernel still hands out the two providers the worker asks for. The last one is the quiet
 * precondition — a kernel that stopped exporting its registry would leave this module's imports
 * looking perfectly correct.
 */

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined
 * when the entity applies it if the graph is entered through the validators rather than the entities.
 */
import '../core/entities/internal';

import { DynamicModule } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventOutboxDispatchScheduler } from './event-outbox-dispatch.scheduler';
import { EventOutboxDispatchWorker } from './event-outbox-dispatch.worker';
import { EventOutboxMaintenanceModule } from './event-outbox-maintenance.module';
import { EventOutboxModule } from './event-outbox.module';
import { EventOutboxService } from './event-outbox.service';

/** The entries of one module's `imports`, which are module classes and dynamic registrations alike. */
function importsOf(module: unknown): unknown[] {
	return (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module as never) ?? []) as unknown[];
}

/** The one dynamic registration the maintenance module makes. */
function registration(): DynamicModule {
	const dynamic = importsOf(EventOutboxMaintenanceModule).find(
		(entry): entry is DynamicModule => !!entry && typeof entry === 'object' && 'module' in entry
	);

	expect(dynamic).toBeDefined();

	return dynamic as DynamicModule;
}

describe('EventOutboxMaintenanceModule — the registration the pass is declared through', () => {
	it('imports the kernel, so the application that wants a drained outbox imports one module', () => {
		// The ordinary direction: the maintenance module depends on the kernel, and never the other way
		// round. An edge back from the kernel would close a cycle between two modules that exist for
		// each other, which is the reason the sweep lives here rather than beside the service.
		expect(importsOf(EventOutboxMaintenanceModule)).toContain(EventOutboxModule);
	});

	it('declares both halves of the pass as job providers', () => {
		const declared = registration();

		// The schedule and the worker are two providers and not one: the first is discovered and ticked,
		// the second is a queue processor. Declaring only one of them is a pass that fires into a queue
		// nothing consumes, or a consumer nothing ever enqueues to.
		expect(declared.providers).toContain(EventOutboxDispatchScheduler);
		expect(declared.providers).toContain(EventOutboxDispatchWorker);
		// Handed on as well as declared, which is what `forFeature` does with a job provider so the
		// discovery pass in the scheduler's own injector can reach it.
		expect(declared.exports).toContain(EventOutboxDispatchScheduler);
		expect(declared.exports).toContain(EventOutboxDispatchWorker);
	});

	it('carries the kernel into the registration’s own injector', () => {
		const declared = registration();

		// The load-bearing line. Without it the worker is constructed in the scheduler's injector with
		// nothing there to satisfy `EventOutboxService` or `EventConsumerRegistry`, and the process dies
		// at boot — which is better than the alternative, but is not what anybody reading
		// `imports: [EventOutboxModule]` on the outer module would expect to be necessary.
		expect(declared.imports).toContain(EventOutboxModule);
	});

	it('registers a queue of its own for the pass to travel on', () => {
		const declared = registration();
		const queues = (declared.imports ?? []).filter((entry) => entry !== EventOutboxModule);

		// The queue registration is the other thing `forFeature` adds, and it is what makes the worker's
		// processor resolvable: a worker declared on a queue this process never registered is a worker
		// that is never handed a job.
		expect(queues.length).toBeGreaterThan(0);
	});
});

describe('EventOutboxMaintenanceModule — what the worker asks the kernel for', () => {
	it('is what the kernel hands out', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EventOutboxModule) ?? []) as unknown[];

		// The quiet precondition: the registration above imports the kernel, but importing a module only
		// reaches what that module exports. These are the two the worker's constructor names.
		expect(exported).toContain(EventOutboxService);
		expect(exported).toContain(EventConsumerRegistry);
	});

	it('is what the worker’s constructor declares, and nothing else', () => {
		// Both, and only both: a third dependency added without being carried into the registration above
		// is the same boot failure, and this is where the two lists are compared.
		expect(EventOutboxDispatchWorker.length).toBe(2);
		// The schedule injects nothing — it enqueues a request and returns — so it can be instantiated
		// wherever it is declared.
		expect(EventOutboxDispatchScheduler.length).toBe(0);
	});
});
