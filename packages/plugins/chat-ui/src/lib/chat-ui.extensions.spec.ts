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
import {
	CHAT_EMPLOYEE_ACTIONS_SLOT,
	CHAT_MESSAGE_EMPLOYEE_EXTENSION_ID,
	CHAT_SEND_TASK_EXTENSION_ID,
	CHAT_TASK_ACTIONS_SLOT
} from './chat-ui.constants';
import { CHAT_MESSAGE_EMPLOYEE_EXTENSION, CHAT_SEND_TASK_EXTENSION, ChatUiPlugin } from './chat-ui.plugin';
import {
	EMPLOYEE_VIEW_ID_PARAM,
	MessageEmployeeButtonComponent
} from './components/message-employee-button/message-employee-button.component';
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
		expect(ChatUiPlugin.extensions).toEqual([CHAT_SEND_TASK_EXTENSION, CHAT_MESSAGE_EMPLOYEE_EXTENSION]);
	});

	it('puts "Message" in the actions of an employee page, for senders where the chat is on', async () => {
		expect(CHAT_EMPLOYEE_ACTIONS_SLOT).toBe(PAGE_EXTENSION_SLOTS.EMPLOYEE_VIEW_ACTIONS);
		expect(CHAT_MESSAGE_EMPLOYEE_EXTENSION).toMatchObject({
			id: CHAT_MESSAGE_EMPLOYEE_EXTENSION_ID,
			slotId: PAGE_EXTENSION_SLOTS.EMPLOYEE_VIEW_ACTIONS,
			permissions: [PermissionsEnum.CHAT_VIEW, PermissionsEnum.CHAT_SEND],
			featureKey: FeatureEnum.FEATURE_CHAT
		});
		await expect(CHAT_MESSAGE_EMPLOYEE_EXTENSION.loadComponent?.()).resolves.toBe(MessageEmployeeButtonComponent);
		expect(EMPLOYEE_VIEW_ID_PARAM).toBe('id');
	});

	it('loads the button on first use, which reads the task of the page route', async () => {
		expect(CHAT_SEND_TASK_EXTENSION.component).toBeUndefined();
		await expect(CHAT_SEND_TASK_EXTENSION.loadComponent?.()).resolves.toBe(SendTaskButtonComponent);
		expect(TASK_VIEW_ID_PARAM).toBe('id');
	});
});
