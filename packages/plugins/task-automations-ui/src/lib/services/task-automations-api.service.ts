import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
	ID,
	ITaskAutomationRule,
	ITaskAutomationRuleCreateInput,
	ITaskAutomationRuleUpdateInput,
	ITaskAutomationRun,
	ITaskAutomationTemplate,
	ITaskAutomationTestResult
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

const AUTOMATIONS = `${API_PREFIX}/task-automations`;

function id(value: ID): string {
	return encodeURIComponent(value);
}

/** `?organizationId=` of the routes (the API refuses an organization other than the one the request works in). */
function organization(organizationId?: ID | null, params = new HttpParams()): { params: HttpParams } {
	return { params: organizationId ? params.set('organizationId', organizationId) : params };
}

/**
 * The task automation routes of the API (`@gauzy/plugin-task-automations`, `/api/task-automations`,
 * `TASK_AUTOMATION_MANAGE` on every route). They exist only where the API loads the plugin
 * (`GAUZY_TASK_AUTOMATIONS_ENABLED=true`): elsewhere every call answers 404.
 */
@Injectable({ providedIn: 'root' })
export class TaskAutomationsApiService {
	private readonly http = inject(HttpClient);

	/** The built-in templates (also the availability probe). */
	templates(): Observable<ITaskAutomationTemplate[]> {
		return this.http.get<ITaskAutomationTemplate[]>(`${AUTOMATIONS}/templates`);
	}

	/** The organization's rules, in their order. */
	list(organizationId?: ID | null): Observable<ITaskAutomationRule[]> {
		return this.http.get<ITaskAutomationRule[]>(AUTOMATIONS, organization(organizationId));
	}

	/** A new rule, blank or from a template (the template fills what the input leaves out). */
	create(input: ITaskAutomationRuleCreateInput, organizationId?: ID | null): Observable<ITaskAutomationRule> {
		return this.http.post<ITaskAutomationRule>(AUTOMATIONS, { ...input, ...(organizationId ? { organizationId } : {}) });
	}

	/** Edits a rule: only the fields stated change. */
	update(ruleId: ID, input: ITaskAutomationRuleUpdateInput, organizationId?: ID | null): Observable<ITaskAutomationRule> {
		return this.http.put<ITaskAutomationRule>(`${AUTOMATIONS}/${id(ruleId)}`, {
			...input,
			...(organizationId ? { organizationId } : {})
		});
	}

	/** Puts the organization's rules in a new order; answers the rules in it. */
	reorder(ids: ID[], organizationId?: ID | null): Observable<ITaskAutomationRule[]> {
		return this.http.put<ITaskAutomationRule[]>(`${AUTOMATIONS}/order`, { ids, ...(organizationId ? { organizationId } : {}) });
	}

	/** Deletes a rule with its run history. */
	remove(ruleId: ID, organizationId?: ID | null): Observable<{ id: ID; deleted: true }> {
		return this.http.delete<{ id: ID; deleted: true }>(`${AUTOMATIONS}/${id(ruleId)}`, organization(organizationId));
	}

	/** What the rule would do to a task (nothing is written). */
	test(ruleId: ID, taskId: ID, organizationId?: ID | null): Observable<ITaskAutomationTestResult> {
		return this.http.post<ITaskAutomationTestResult>(`${AUTOMATIONS}/${id(ruleId)}/test`, {
			taskId,
			...(organizationId ? { organizationId } : {})
		});
	}

	/** The rule's last runs, newest first. */
	runs(ruleId: ID, limit: number, organizationId?: ID | null): Observable<ITaskAutomationRun[]> {
		return this.http.get<ITaskAutomationRun[]>(
			`${AUTOMATIONS}/${id(ruleId)}/runs`,
			organization(organizationId, new HttpParams().set('limit', String(limit)))
		);
	}
}
