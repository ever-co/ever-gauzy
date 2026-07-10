import { buildSystemPrompt, ISystemPromptContext } from './system-prompt';

describe('buildSystemPrompt', () => {
	beforeAll(() => {
		// Freeze time so the "Today's date" line is deterministic.
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	describe('user identity and context', () => {
		it("should include today's date (YYYY-MM-DD)", () => {
			const prompt = buildSystemPrompt({});
			expect(prompt).toContain("Today's date: 2026-01-15.");
		});

		it('should include the user name and role', () => {
			const prompt = buildSystemPrompt({ userName: 'John Doe', roleName: 'ADMIN' });
			expect(prompt).toContain('You are assisting: John Doe (role: ADMIN).');
		});

		it('should fall back to a generic user description when the name is missing', () => {
			const prompt = buildSystemPrompt({});
			expect(prompt).toContain('You are assisting: a platform user.');
		});

		it('should omit the role suffix when only the name is known', () => {
			const prompt = buildSystemPrompt({ userName: 'John Doe' });
			expect(prompt).toContain('You are assisting: John Doe.');
			expect(prompt).not.toContain('(role:');
		});

		it('should include the organization line only when an organization is set', () => {
			const withOrg = buildSystemPrompt({ organizationName: 'Ever Co.' });
			expect(withOrg).toContain('Active organization: Ever Co..');
			expect(buildSystemPrompt({})).not.toContain('Active organization');
		});

		it('should mention the employee registration only when an employeeId is set', () => {
			const withEmployee = buildSystemPrompt({ employeeId: 'emp-1' });
			expect(withEmployee).toContain('The user is registered as an employee');
			expect(buildSystemPrompt({})).not.toContain('registered as an employee');
		});
	});

	describe('permissions note', () => {
		it('should use the fallback note when permissions are not provided', () => {
			const prompt = buildSystemPrompt({});
			expect(prompt).toContain(
				'The exact permission list is not available — rely on tool errors to detect missing permissions.'
			);
			expect(prompt).not.toContain("The user's permissions include:");
		});

		it('should use the fallback note when the permission list is empty', () => {
			const prompt = buildSystemPrompt({ permissions: [] });
			expect(prompt).toContain('The exact permission list is not available');
		});

		it('should list the permissions when provided', () => {
			const prompt = buildSystemPrompt({ permissions: ['ORG_TASK_VIEW', 'ORG_TASK_EDIT'] });
			expect(prompt).toContain("The user's permissions include: ORG_TASK_VIEW, ORG_TASK_EDIT.");
			expect(prompt).not.toContain('The exact permission list is not available');
		});

		it('should cap the listed permissions at 60', () => {
			const permissions = Array.from({ length: 61 }, (_, i) => `PERMISSION_${i}`);
			const prompt = buildSystemPrompt({ permissions });
			expect(prompt).toContain('PERMISSION_59');
			expect(prompt).not.toContain('PERMISSION_60');
		});
	});

	describe('language', () => {
		it('should include the language line when languageCode is set', () => {
			const prompt = buildSystemPrompt({ languageCode: 'fr' });
			expect(prompt).toContain("Respond in the user's language: fr.");
		});

		it('should omit the language line when languageCode is not set', () => {
			expect(buildSystemPrompt({})).not.toContain("Respond in the user's language");
		});
	});

	describe('output hygiene', () => {
		const contexts: [string, ISystemPromptContext][] = [
			['empty context', {}],
			[
				'full context',
				{
					userName: 'Jane Roe',
					roleName: 'EMPLOYEE',
					organizationName: 'Ever Co.',
					tenantName: 'Ever',
					employeeId: 'emp-42',
					permissions: ['ORG_TASK_VIEW'],
					languageCode: 'de'
				}
			],
			['partial context', { userName: 'Solo User' }]
		];

		it.each(contexts)("should never contain the string 'undefined' (%s)", (_label, context) => {
			expect(buildSystemPrompt(context)).not.toContain('undefined');
		});

		it('should not emit blank lines from skipped optional sections', () => {
			const prompt = buildSystemPrompt({});
			// falsy lines are filtered out before joining, so no blank lines remain
			expect(prompt).not.toMatch(/\n\n/);
		});
	});
});
