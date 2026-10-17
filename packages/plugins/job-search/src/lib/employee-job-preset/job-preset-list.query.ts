import type { Knex } from 'knex';

/**
 * The MikroORM (knex) query listing a tenant's job presets, optionally narrowed to an organization, a name
 * search and an employee.
 *
 * - Soft-deleted presets are left out: raw knex skips MikroORM's soft-delete filter, so a deleted preset
 *   was still listed (the TypeORM branch leaves them out).
 * - The name search is a case-insensitive `LIKE` on the lowered name: `ILIKE` exists on PostgreSQL only,
 *   so searching failed on MySQL and SQLite.
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
		.leftJoin('job_preset_employee', 'job_preset.id', 'job_preset_employee.jobPresetId')
		.where('job_preset.tenantId', tenantId)
		.whereNull('job_preset.deletedAt');

	if (organizationId) {
		qb = qb.andWhere('job_preset.organizationId', organizationId);
	}
	if (search) {
		qb = qb.andWhereRaw('LOWER(??) LIKE ?', ['job_preset.name', `%${search.toLowerCase()}%`]);
	}
	if (employeeId) {
		qb = qb.andWhere('job_preset_employee.employeeId', employeeId);
	}

	return qb.select('job_preset.*').orderBy('job_preset.name', 'asc').distinct();
}
