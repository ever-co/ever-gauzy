/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { getMetadataArgsStorage } from 'typeorm';
import { Employee, OrganizationTeam } from '../core/entities/internal';
import { mentionsAssignedComments, withoutAssignedComments } from './assigned-comments';

/**
 * The comments an employee or a team is assigned (`assignedComments`) are the other side of a comment's `members` and
 * `teams`. They are written through the comment API only, where the comment's record policy decides (a contact's note
 * is assigned to nobody), and read past that policy by no route.
 */
describe('assigned comments', () => {
	describe('withoutAssignedComments', () => {
		it('leaves the comments out of an employee’s or a team’s input, and the input itself unchanged', () => {
			const input = { name: 'Team', assignedComments: [{ id: 'note' }] };

			expect(withoutAssignedComments(input)).toEqual({ name: 'Team' });
			expect(input.assignedComments).toEqual([{ id: 'note' }]);
		});

		it('returns an input that names no comments as it is', () => {
			const input = { name: 'Team' };

			expect(withoutAssignedComments(input)).toBe(input);
			expect(withoutAssignedComments(null)).toBeNull();
			expect(withoutAssignedComments(undefined)).toBeUndefined();
		});
	});

	describe('mentionsAssignedComments', () => {
		it.each([
			['a list of relations', { relations: ['members.employee.assignedComments'] }],
			['a relation tree', { relations: { members: { employee: { assignedComments: 'true' } } } }],
			['a single relation', { relations: 'assignedComments' }],
			['a JSON parameter', { data: '{"relations":["assignedComments"]}' }],
			['another casing', { relations: ['ASSIGNEDCOMMENTS'] }],
			['a selection', { select: { assignedComments: { id: 'true' } } }],
			['a body', { findInput: { relations: ['employee.assignedComments'] } }]
		])('finds the relation named in %s', (_label, request) => {
			expect(mentionsAssignedComments(request)).toBe(true);
		});

		it('finds nothing in a request that does not name it', () => {
			expect(mentionsAssignedComments({ relations: ['members.employee.user'], take: '10' })).toBe(false);
			expect(mentionsAssignedComments({})).toBe(false);
			expect(mentionsAssignedComments(undefined)).toBe(false);
			expect(mentionsAssignedComments(Buffer.from('assignedComments'))).toBe(false);
		});

		it('counts a request nested deeper than it looks as naming it', () => {
			let nested: Record<string, unknown> = { leaf: 'value' };
			for (let level = 0; level < 20; level++) {
				nested = { level: nested };
			}

			expect(mentionsAssignedComments(nested)).toBe(true);
		});
	});

	it.each([
		['an employee', Employee],
		['a team', OrganizationTeam]
	])('never writes the comments %s is assigned when it is saved, directly or through a cascade', (_label, target) => {
		const relation = getMetadataArgsStorage().relations.find(
			(args) => args.target === target && args.propertyName === 'assignedComments'
		);

		expect(relation?.options.persistence).toBe(false);
	});
});
