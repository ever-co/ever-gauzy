import { firstValueFrom } from 'rxjs';
import { NavigationBuilderService } from './navigation-builder.service';
import type { Store } from '../store/store.service';

class FirstAction {}
class SecondAction {}
class ThirdAction {}

/** The header actions plugins register (the Inbox badge is the first one). */
describe('NavigationBuilderService header actions', () => {
	const store = { hasPermission: (permission: string) => permission === 'GRANTED' } as unknown as Store;
	let service: NavigationBuilderService;

	beforeEach(() => {
		service = new NavigationBuilderService(store);
	});

	const ids = async () => (await firstValueFrom(service.headerActions$)).map((action) => action.id);

	it('starts empty, so the header renders nothing extra', async () => {
		await expect(ids()).resolves.toEqual([]);
	});

	it('orders by `order`, keeps registration order otherwise, and replaces an action with the same id', async () => {
		service.registerHeaderAction({ id: 'c', component: ThirdAction });
		service.registerHeaderAction({ id: 'b', component: SecondAction, order: 20 });
		service.registerHeaderAction({ id: 'a', component: FirstAction, order: 10 });
		await expect(ids()).resolves.toEqual(['a', 'b', 'c']);

		service.registerHeaderAction({ id: 'b', component: ThirdAction, order: 5 });
		const actions = await firstValueFrom(service.headerActions$);
		expect(actions.map((action) => action.id)).toEqual(['b', 'a', 'c']);
		expect(actions[0].component).toBe(ThirdAction);
	});

	it('removes an action, and ignores an unknown id', async () => {
		service.registerHeaderAction({ id: 'a', component: FirstAction });
		service.removeHeaderAction('unknown');
		service.removeHeaderAction('a');
		await expect(ids()).resolves.toEqual([]);
	});

	it('refuses an action without an id or a component', () => {
		expect(() => service.registerHeaderAction({ id: '', component: FirstAction })).toThrow();
		expect(() => service.registerHeaderAction({ id: 'x', component: undefined as never })).toThrow();
	});

	it('checks the permissions the header filters on', () => {
		expect(service.hasPermissions([])).toBe(true);
		expect(service.hasPermissions(['GRANTED'])).toBe(true);
		expect(service.hasPermissions(['GRANTED', 'OTHER'])).toBe(false);
	});
});
