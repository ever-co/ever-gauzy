import type { Knex } from 'knex';

/**
 * The MikroORM (knex) query listing a tenant's job presets, optionally narrowed to an organization, a name
 * search and an employee.
 *
 * - Soft-deleted presets are left out: raw knex skips MikroORM's soft-delete filter, so a deleted preset
 *   was still listed (the TypeORM branch leaves them out).
 * - The name search is a case-insensitive `LIKE` on the lowered name: `ILIKE` exists on PostgreSQL only,
 *   so searching failed on MySQL and SQLite.
 * - The employees are joined through the relation's pivot table, `employee_job_preset` (the query named a
 *   `job_preset_employee` table that does not exist, so the list failed).
 */
export function jobPresetListQuery(
	knex: Knex,
	{
		tenantId,
		organizationId,
		search,
		employeeId
	}: { tenantId: string; organizationId?: string; search?: string; employeeId?: string }
): Knex.QueryBuilder {
	let qb = knex('job_preset')
		.leftJoin('employee_job_preset', 'job_preset.id', 'employee_job_preset.jobPresetId')
		.where('job_preset.tenantId', tenantId)
		.whereNull('job_preset.deletedAt');

	if (organizationId) {
		qb = qb.andWhere('job_preset.organizationId', organizationId);
	}
	if (search) {
		qb = qb.andWhereRaw('LOWER(??) LIKE ?', ['job_preset.name', `%${search.toLowerCase()}%`]);
	}
	if (employeeId) {
		qb = qb.andWhere('employee_job_preset.employeeId', employeeId);
	}

	return qb.select('job_preset.*').orderBy('job_preset.name', 'asc').distinct();
}
