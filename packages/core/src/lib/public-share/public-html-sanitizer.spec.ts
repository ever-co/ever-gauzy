/**
 * Sanitize-on-read for the unauthenticated public-share endpoints
 * (`08-permissions-security.md` §6.2).
 *
 * `Organization.overview` and `Employee.description` are editor-authored HTML rendered with
 * `[innerHtml]` on `/public/:profile_link`, a page served to anonymous visitors. Both are
 * sanitized on write — but write-path sanitization only protects rows written after it shipped,
 * and these endpoints are exactly where a payload stored before that would surface. These tests
 * pin the second gate: whatever the database holds, the response is clean.
 *
 * The helper is exercised directly rather than through `PublicOrganizationService` /
 * `PublicEmployeeService`: importing either service pulls in `core/entities/internal`, i.e. the
 * whole entity graph, which is what the standalone-helper split exists to avoid.
 */
import {
	PUBLIC_EMPLOYEE_HTML_FIELDS,
	PUBLIC_ORGANIZATION_HTML_FIELDS,
	sanitizePublicRichTextFields
} from './public-html-sanitizer';

/** A stored payload of the shape that predates write-path sanitization. */
const STORED_PAYLOAD =
	'<p>Hello</p><script>alert(1)</script><img src="https://cdn.example/a.png" onerror="alert(2)" alt="a">' +
	'<a href="javascript:alert(3)">click</a>';

describe('sanitizePublicRichTextFields', () => {
	it('names `overview` as the organization HTML field', () => {
		expect(PUBLIC_ORGANIZATION_HTML_FIELDS).toEqual(['overview']);
	});

	it('names `description` as the employee HTML field', () => {
		expect(PUBLIC_EMPLOYEE_HTML_FIELDS).toEqual(['description']);
	});

	it('drops a script tag from a stored organization overview', () => {
		const organization = sanitizePublicRichTextFields(
			{ id: 'org-1', overview: STORED_PAYLOAD },
			PUBLIC_ORGANIZATION_HTML_FIELDS
		);

		expect(organization.overview).not.toContain('<script');
		expect(organization.overview).not.toContain('alert(1)');
	});

	it('drops an event-handler attribute while keeping the element', () => {
		const organization = sanitizePublicRichTextFields(
			{ overview: STORED_PAYLOAD },
			PUBLIC_ORGANIZATION_HTML_FIELDS
		);

		expect(organization.overview).not.toContain('onerror');
		expect(organization.overview).toContain('https://cdn.example/a.png');
	});

	it('drops a javascript: URL', () => {
		const employee = sanitizePublicRichTextFields(
			{ description: STORED_PAYLOAD },
			PUBLIC_EMPLOYEE_HTML_FIELDS
		);

		// The server allowlist DELETES the attribute rather than prefixing it, unlike Angular.
		expect(employee.description).not.toContain('javascript:');
		expect(employee.description).toContain('click');
	});

	it('drops a data: URL Angular would let through', () => {
		const employee = sanitizePublicRichTextFields(
			{ description: '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>' },
			PUBLIC_EMPLOYEE_HTML_FIELDS
		);

		expect(employee.description).not.toContain('data:');
	});

	it('keeps the legitimate content of a payload — this is sanitization, not deletion', () => {
		const employee = sanitizePublicRichTextFields(
			{ description: STORED_PAYLOAD },
			PUBLIC_EMPLOYEE_HTML_FIELDS
		);

		expect(employee.description).toContain('Hello');
	});

	it('leaves legitimate editor output byte-for-byte unchanged', () => {
		const overview = '<p><strong>Ever</strong> builds open-source software.</p>';

		expect(sanitizePublicRichTextFields({ overview }, PUBLIC_ORGANIZATION_HTML_FIELDS).overview).toBe(overview);
	});

	it('is idempotent, so a row already sanitized on write round-trips unchanged', () => {
		const once = sanitizePublicRichTextFields({ overview: STORED_PAYLOAD }, PUBLIC_ORGANIZATION_HTML_FIELDS)
			.overview;

		expect(sanitizePublicRichTextFields({ overview: once }, PUBLIC_ORGANIZATION_HTML_FIELDS).overview).toBe(once);
	});

	it.each([
		['null', null],
		['undefined', undefined],
		['empty string', '']
	])('leaves an %s value exactly as it is', (_label: string, overview: string | null | undefined) => {
		expect(sanitizePublicRichTextFields({ overview }, PUBLIC_ORGANIZATION_HTML_FIELDS).overview).toBe(overview);
	});

	it('never materializes a field the projection did not select', () => {
		const employee: Record<string, unknown> = { id: 'emp-1' };

		sanitizePublicRichTextFields(employee, PUBLIC_EMPLOYEE_HTML_FIELDS);

		expect('description' in employee).toBe(false);
	});

	it.each([
		['null', null],
		['undefined', undefined]
	])('tolerates a %s record', (_label: string, record: null | undefined) => {
		expect(sanitizePublicRichTextFields(record, PUBLIC_ORGANIZATION_HTML_FIELDS)).toBe(record);
	});
});
