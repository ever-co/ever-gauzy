import { gql } from 'graphql-tag';

/**
 * The task automations' contribution to the one GraphQL schema: the read routes of `/api/task-automations` (the
 * writes stay REST). Registered only with the plugin, so a deployment without `GAUZY_TASK_AUTOMATIONS_ENABLED=true`
 * serves none of it. The field-binding gate reads this document on top of the snapshot — it is named in
 * `GATED_PLUGIN_SCHEMAS` of `tools/scripts/graphql-field-binding-check.mjs` — so it must stay a plain `gql` template
 * (no `${…}`), registered by `TaskAutomationsPlugin` as `schema: taskAutomationSchemaExtensions`.
 *
 * Enumerated values (trigger, condition and action types, outcomes) are strings holding the REST values; the trigger,
 * the conditions, the actions and a run's details are `JSON` with the REST shapes.
 */
export const taskAutomationSchemaExtensions = gql`
	"An automation rule of the organization: a trigger, conditions and actions."
	type TaskAutomationRule {
		id: ID!
		tenantId: ID
		organizationId: ID
		name: String!
		description: String
		projectId: ID
		organizationTeamId: ID
		isEnabled: Boolean!
		position: Int!
		templateKey: String
		"The trigger: { type, toStatuses?, fromStatuses?, mergedOnly? }."
		trigger: JSON!
		"The conditions: [{ type, values?, text? }]."
		conditions: JSON!
		"The actions: [{ type, status?, category?, priority?, employeeIds?, tagIds?, message? }]."
		actions: JSON!
		lastRunAt: DateTime
		createdByUserId: ID
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One run of a rule for one task."
	type TaskAutomationRun {
		id: ID!
		ruleId: ID!
		taskId: ID
		eventKey: String!
		triggerType: String!
		"APPLIED, PARTIAL, NO_CHANGE, CONDITIONS_NOT_MET, LOOP_GUARD, RATE_LIMITED, FAILED or RUNNING."
		outcome: String!
		depth: Int!
		"{ changes?, conditions?, note? }."
		details: JSON
		error: String
		durationMs: Int
		createdAt: DateTime
	}

	"A built-in starting point for a rule."
	type TaskAutomationTemplate {
		key: String!
		name: String!
		description: String!
		trigger: JSON!
		conditions: JSON!
		actions: JSON!
		requiresIntegration: Boolean
		needsInput: Boolean
	}

	extend type Query {
		"GET /task-automations: the organization's rules in their order."
		taskAutomationRules(organizationId: ID, projectId: ID, organizationTeamId: ID): [TaskAutomationRule!]!
		"GET /task-automations/:id."
		taskAutomationRule(id: ID!, organizationId: ID): TaskAutomationRule!
		"GET /task-automations/:id/runs: newest first, at most 50."
		taskAutomationRuns(ruleId: ID!, organizationId: ID, limit: Int): [TaskAutomationRun!]!
		"GET /task-automations/templates."
		taskAutomationTemplates: [TaskAutomationTemplate!]!
	}
`;
