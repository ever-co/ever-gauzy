import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { IEmployeeNotification } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { InboxNotificationsService } from '../../services/inbox-ui.service';
import { InboxNotificationsComponent } from './inbox-notifications.component';

const notification = (id: string, isRead: boolean) => ({ id, isRead, message: `Note ${id}` }) as IEmployeeNotification;

/** The Notifications tab: Gauzy's own notifications of my employee. */
describe('InboxNotificationsComponent', () => {
	const api = { list: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn() };

	function render() {
		TestBed.configureTestingModule({
			imports: [InboxNotificationsComponent],
			providers: [
				{ provide: InboxNotificationsService, useValue: api },
				{
					provide: Store,
					useValue: {
						user$: of({ tenantId: 't1', employee: { id: 'e1' } }),
						selectedOrganization$: of({ id: 'o1' })
					}
				}
			]
		});
		const fixture = TestBed.createComponent(InboxNotificationsComponent);
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance };
	}

	beforeEach(() => jest.resetAllMocks());

	it("'Mark all read' stays available while older notifications are not loaded yet (review F69)", () => {
		// The newest page is read; 5 older ones (not loaded) may not be.
		api.list.mockReturnValue(
			of({ items: Array.from({ length: 20 }, (_, n) => notification(`n${n}`, true)), total: 25 })
		);
		const { component } = render();
		expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ receiverEmployeeId: 'e1', skip: 0 }));
		expect(component.hasUnread()).toBe(true);
	});

	it("once 'Mark all read' went through, the notifications not loaded count as read (#11098 review)", () => {
		api.list.mockReturnValue(
			of({ items: Array.from({ length: 20 }, (_, n) => notification(`n${n}`, true)), total: 25 })
		);
		api.markAllRead.mockReturnValue(of({ count: 25 }));
		const { component } = render();
		expect(component.hasUnread()).toBe(true);
		component.markAllRead();
		expect(api.list).toHaveBeenCalledTimes(2);
		expect(component.hasUnread()).toBe(false);
	});

	it("'Mark all read' is off when every notification is loaded and read", () => {
		api.list.mockReturnValue(of({ items: [notification('n1', true)], total: 1 }));
		expect(render().component.hasUnread()).toBe(false);
	});
});
