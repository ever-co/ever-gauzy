import { ApprovalPolicyCreateHandler } from './approval-policy.create.handler';
import { ApprovalPolicyGetHandler } from './approval-policy.get.handler';
import { ApprovalPolicyUpdateHandler } from './approval-policy.update.handler';
import { RequestApprovalPolicyGetHandler } from './request-approval-policy.get.handler';

export const CommandHandlers = [
	ApprovalPolicyCreateHandler,
	ApprovalPolicyGetHandler,
	RequestApprovalPolicyGetHandler,
	ApprovalPolicyUpdateHandler
];
