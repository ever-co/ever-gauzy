// The ui-core barrel boots half the app (and needs packages this spec does not): what the plugin names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({
	NavigationBuilderService: class NavigationBuilderService {},
	NavMenuBuilderService: class NavMenuBuilderService {},
	PermissionsGuard: class PermissionsGuard {},
	Store: class Store {},
	ToastrService: class ToastrService {}
}));
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { PAGE_EXTENSION_SLOTS } from '@gauzy/plugin-ui';
import { CHAT_SEND_TASK_EXTENSION_ID, CHAT_TASK_ACTIONS_SLOT } from './chat-ui.constants';
import { CHAT_SEND_TASK_EXTENSION, ChatUiPlugin } from './chat-ui.plugin';
import { SendTaskButtonComponent, TASK_VIEW_ID_PARAM } from './components/send-task-button/send-task-button.component';

describe('ChatUiPlugin extensions', () => {
	it('puts "Send to chat" in the actions of a task page, for senders where the chat is on', () => {
		expect(CHAT_TASK_ACTIONS_SLOT).toBe(PAGE_EXTENSION_SLOTS.TASK_VIEW_ACTIONS);
		expect(CHAT_SEND_TASK_EXTENSION).toMatchObject({
			id: CHAT_SEND_TASK_EXTENSION_ID,
			slotId: PAGE_EXTENSION_SLOTS.TASK_VIEW_ACTIONS,
			permissions: [PermissionsEnum.CHAT_SEND],
			featureKey: FeatureEnum.FEATURE_CHAT
		});
		expect(ChatUiPlugin.extensions).toEqual([CHAT_SEND_TASK_EXTENSION]);
	});

	it('loads the button on first use, which reads the task of the page route', async () => {
		expect(CHAT_SEND_TASK_EXTENSION.component).toBeUndefined();
		await expect(CHAT_SEND_TASK_EXTENSION.loadComponent?.()).resolves.toBe(SendTaskButtonComponent);
		expect(TASK_VIEW_ID_PARAM).toBe('id');
	});
});
