/**
 * The worker's whole reason to exist is that the heavy `docs-processing` stages run HERE and not
 * in the API process (`10-implementation-plan.md` §2.6, mitigation R7). That guarantee is made by
 * module metadata alone, and module metadata fails silently: registering the plugin config without
 * importing `PluginModule` leaves the plugin's Nest module out of the container, so the BullMQ
 * `@Processor` host is never constructed and this process idles while the API keeps doing the
 * work — with no error anywhere. These tests pin the wiring.
 *
 * `@gauzy/core`, `@gauzy/plugin` and `@gauzy/scheduler` are barrels over the ORM bootstrap and the
 * BullMQ root; only the module tokens matter here, so stubs stand in for the real classes.
 */
jest.mock('@gauzy/core', () => ({
	ActivityLogModule: class ActivityLogModule {},
	DatabaseModule: class DatabaseModule {},
	MentionModule: class MentionModule {},
	TokenModule: { forRoot: jest.fn(() => ({ module: class TokenModule {} })) }
}));

jest.mock('@gauzy/plugin', () => {
	class PluginModule {}
	return {
		PluginModule: Object.assign(PluginModule, {
			init: jest.fn(() => ({ module: PluginModule, imports: [] }))
		})
	};
});

jest.mock('@gauzy/scheduler', () => ({
	SchedulerModule: {
		forRoot: jest.fn(() => ({ module: class SchedulerModule {} })),
		forFeature: jest.fn(() => ({ module: class SchedulerModule {} }))
	}
}));

jest.mock('./worker-jobs.module', () => ({ WorkerJobsModule: class WorkerJobsModule {} }));

// `@Module()` writes its metadata through `Reflect.defineMetadata`; nothing else in this file
// pulls the polyfill in, and without it the reads below come back undefined.
import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ActivityLogModule, MentionModule } from '@gauzy/core';
import { PluginModule } from '@gauzy/plugin';
import { AppModule } from './app.module';

const imports = (): any[] => Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? [];

describe('worker AppModule', () => {
	it('instantiates the registered plugins through PluginModule.init()', () => {
		expect(PluginModule.init).toHaveBeenCalled();
		expect(imports().some((imported) => imported?.module === PluginModule)).toBe(true);
	});

	it('imports ActivityLogModule so plugin activity-log writers can resolve their service', () => {
		// `@Global()` only means "available once imported" — the worker never imports core's AppModule.
		expect(imports()).toContain(ActivityLogModule);
	});

	it('imports MentionModule so plugin @mention fan-out can resolve its service', () => {
		expect(imports()).toContain(MentionModule);
	});
});
