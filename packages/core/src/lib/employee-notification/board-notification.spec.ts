import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeeNotificationTypeEnum } from '@gauzy/contracts';
import {
	BoardNotificationDTO,
	boardNotificationsOf,
	boardNotificationTitle,
	boardOf,
	isSameBoard,
	IBoardNotificationSender
} from './board-notification';

const TENANT = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a0001';
const ORG = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a0002';
const OTHER_ORG = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a0003';
const ANA = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00a1';
const ANA_ELSEWHERE = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00a2';
const BEN = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00b1';
const CLEO = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00c1';
const LINK = 'https://boards.example/#room=r00m,secret-key';

const ana: IBoardNotificationSender = {
	userId: 'user-ana',
	tenantId: TENANT,
	name: 'Ana Lima',
	lastOrganizationId: ORG,
	employeeId: ANA
};

/**
 * The employees as the database answers: `find` gets the sender's own rows (by `userId`) and then the people named
 * (by `id`); each answer is filtered here as the database would, by tenant and organization.
 */
function databaseOf(
	rows: Array<{
		id: string;
		userId?: string;
		organizationId: string;
		tenantId?: string;
		isActive?: boolean;
		isArchived?: boolean;
	}>
) {
	const all = rows.map((row) => ({ tenantId: TENANT, isActive: true, isArchived: false, ...row }));
	const find = jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
		if (where['userId']) {
			return all.filter((row) => row.userId === where['userId'] && row.tenantId === where['tenantId']);
		}
		const ids = new Set(((where['id'] as { value: string[] }).value ?? []).map(String));
		return all.filter(
			(row) =>
				ids.has(row.id) && row.organizationId === where['organizationId'] && row.tenantId === where['tenantId']
		);
	});
	const dataSource = { getRepository: jest.fn(() => ({ find })) };
	return { find, dataSource: dataSource as never };
}

const people = [
	{ id: ANA, userId: 'user-ana', organizationId: ORG },
	{ id: ANA_ELSEWHERE, userId: 'user-ana', organizationId: OTHER_ORG },
	{ id: BEN, organizationId: ORG },
	{ id: CLEO, organizationId: ORG }
];

describe('the Board a request names', () => {
	it('keeps the room or the snapshot, the name on one line and the link as sent', () => {
		expect(boardOf({ roomId: 'r00m', boardName: '  Sprint \n plan ', link: LINK })).toEqual({
			roomId: 'r00m',
			name: 'Sprint plan',
			link: LINK
		});
		expect(boardOf({ snapshotId: 'snap_1' })).toEqual({ snapshotId: 'snap_1', name: null, link: null });
	});

	it('refuses a request that names neither a room nor a snapshot, or both', () => {
		expect(() => boardOf({})).toThrow(BadRequestException);
		expect(() => boardOf({ roomId: 'r00m', snapshotId: 'snap_1' })).toThrow(BadRequestException);
	});

	it('tells the same Board at the same link from another Board, or the same one at another link', () => {
		const board = { roomId: 'r00m', name: 'Sprint plan', link: LINK };
		expect(isSameBoard({ roomId: 'r00m', name: 'Renamed', link: LINK }, board)).toBe(true);
		expect(isSameBoard({ roomId: 'r00m', link: 'https://boards.example/' }, board)).toBe(false);
		expect(isSameBoard({ roomId: 'other', link: LINK }, board)).toBe(false);
		expect(isSameBoard({ snapshotId: 'r00m', link: LINK }, board)).toBe(false);
		expect(isSameBoard({ snapshotId: 'snap_1', link: null }, { snapshotId: 'snap_1', link: null })).toBe(true);
		expect(isSameBoard(null, board)).toBe(false);
		expect(isSameBoard('r00m', board)).toBe(false);
	});
});

describe('the title of a Board notification', () => {
	it('says who shared or mentioned, and the Board when its name was sent', () => {
		const share = EmployeeNotificationTypeEnum.BOARD_SHARE;
		const mention = EmployeeNotificationTypeEnum.BOARD_MENTION;
		expect(boardNotificationTitle(share, 'Ana Lima', 'Sprint plan')).toBe(
			'Ana Lima shared the Board "Sprint plan" with you'
		);
		expect(boardNotificationTitle(share, 'Ana Lima', null)).toBe('Ana Lima shared a Board with you');
		expect(boardNotificationTitle(mention, 'Ana Lima', 'Sprint plan')).toBe(
			'Ana Lima mentioned you in the Board "Sprint plan"'
		);
		expect(boardNotificationTitle(mention, ' ', '')).toBe('Someone mentioned you in a Board');
	});

	it('fits the title column whatever the names', () => {
		const title = boardNotificationTitle(
			EmployeeNotificationTypeEnum.BOARD_SHARE,
			'A'.repeat(300),
			'B'.repeat(300)
		);
		expect(title.length).toBeLessThanOrEqual(255);
		expect(title).toContain('…');
	});
});

describe('boardNotificationsOf', () => {
	const input = { receiverEmployeeIds: [BEN, CLEO], roomId: 'r00m', boardName: 'Sprint plan', link: LINK };

	it('files one notification per colleague of the organization, as the sender, with the Board in the metadata', async () => {
		const { dataSource } = databaseOf(people);

		const notifications = await boardNotificationsOf(
			dataSource,
			EmployeeNotificationTypeEnum.BOARD_SHARE,
			input,
			ana
		);

		const board = { roomId: 'r00m', name: 'Sprint plan', link: LINK };
		expect(notifications).toEqual([
			{
				type: EmployeeNotificationTypeEnum.BOARD_SHARE,
				title: 'Ana Lima shared the Board "Sprint plan" with you',
				entity: null,
				entityId: null,
				metadata: { board },
				receiverEmployeeId: BEN,
				sentByEmployeeId: ANA,
				organizationId: ORG,
				tenantId: TENANT
			},
			expect.objectContaining({ receiverEmployeeId: CLEO })
		]);
	});

	it('reads the people in the tenant and the organization of the sender only', async () => {
		const { dataSource, find } = databaseOf(people);

		await boardNotificationsOf(dataSource, EmployeeNotificationTypeEnum.BOARD_MENTION, input, ana);

		expect(find).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ where: { userId: 'user-ana', tenantId: TENANT } })
		);
		expect(find).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG, tenantId: TENANT }) })
		);
	});

	it('leaves out the sender, a colleague named twice, and anyone who does not work in the organization', async () => {
		const { dataSource } = databaseOf([
			...people,
			{ id: '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00d1', organizationId: ORG, isActive: false, isArchived: true },
			{ id: '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00e1', organizationId: OTHER_ORG },
			{
				id: '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00f1',
				organizationId: ORG,
				tenantId: '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a0009'
			}
		]);

		const notifications = await boardNotificationsOf(
			dataSource,
			EmployeeNotificationTypeEnum.BOARD_SHARE,
			{
				...input,
				receiverEmployeeIds: [
					ANA,
					BEN,
					BEN.toUpperCase(),
					'0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00d1',
					'0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00e1',
					'0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00f1',
					'0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a0404'
				]
			},
			ana
		);

		expect(notifications.map((notification) => notification.receiverEmployeeId)).toEqual([BEN]);
	});

	it('files nothing, and reads nobody, when the sender named only themselves', async () => {
		const { dataSource, find } = databaseOf(people);

		await expect(
			boardNotificationsOf(
				dataSource,
				EmployeeNotificationTypeEnum.BOARD_SHARE,
				{ ...input, receiverEmployeeIds: [ANA] },
				ana
			)
		).resolves.toEqual([]);
		expect(find).toHaveBeenCalledTimes(1);
	});

	it('works in the organization the request names, when the sender works there', async () => {
		const { dataSource } = databaseOf([
			...people,
			{ id: '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00e1', organizationId: OTHER_ORG }
		]);

		const notifications = await boardNotificationsOf(
			dataSource,
			EmployeeNotificationTypeEnum.BOARD_SHARE,
			{ ...input, organizationId: OTHER_ORG, receiverEmployeeIds: [BEN, '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00e1'] },
			ana
		);

		expect(notifications).toEqual([
			expect.objectContaining({
				receiverEmployeeId: '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00e1',
				sentByEmployeeId: ANA_ELSEWHERE,
				organizationId: OTHER_ORG
			})
		]);
	});

	it('works in the organization of the employee the sign-in names when the last organization is none of theirs', async () => {
		const { dataSource } = databaseOf(people);

		const notifications = await boardNotificationsOf(dataSource, EmployeeNotificationTypeEnum.BOARD_SHARE, input, {
			...ana,
			lastOrganizationId: null
		});

		expect(notifications[0]).toEqual(expect.objectContaining({ sentByEmployeeId: ANA, organizationId: ORG }));
	});

	it('refuses a sender who does not work in the organization: named in the request, another tenant, or no longer working', async () => {
		const elsewhere = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a0404';
		await expect(
			boardNotificationsOf(
				databaseOf(people).dataSource,
				EmployeeNotificationTypeEnum.BOARD_SHARE,
				{ ...input, organizationId: elsewhere },
				ana
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			boardNotificationsOf(databaseOf(people).dataSource, EmployeeNotificationTypeEnum.BOARD_SHARE, input, {
				...ana,
				tenantId: elsewhere
			})
		).rejects.toBeInstanceOf(ForbiddenException);
		const ended = people.map((row) => (row.userId ? { ...row, isActive: false, isArchived: true } : row));
		await expect(
			boardNotificationsOf(databaseOf(ended).dataSource, EmployeeNotificationTypeEnum.BOARD_SHARE, input, ana)
		).rejects.toBeInstanceOf(ForbiddenException);
	});
});

describe('BoardNotificationDTO', () => {
	async function problemsOf(body: Record<string, unknown>): Promise<string[]> {
		const errors = await validate(plainToInstance(BoardNotificationDTO, body), {
			whitelist: true,
			forbidUnknownValues: false
		});
		return errors.map((error) => error.property);
	}
	const body = { receiverEmployeeIds: [BEN], roomId: 'r00m', boardName: 'Sprint plan', link: LINK };

	it('takes what the Boards app sends, the encryption key in the link and a local Boards app included', async () => {
		expect(await problemsOf(body)).toEqual([]);
		expect(
			await problemsOf({ ...body, organizationId: ORG, link: 'http://localhost:3030/#json=snap_1,key' })
		).toEqual([]);
		expect(await problemsOf({ receiverEmployeeIds: [BEN], snapshotId: 'snap_1' })).toEqual([]);
	});

	it('refuses a link that is no web address, or carries a sign-in', async () => {
		for (const link of [
			'javascript:alert(1)',
			'ftp://boards.example/',
			'boards.example/#room=a,b',
			'https://ana:pw@boards.example/',
			'x'.repeat(2049)
		]) {
			expect(await problemsOf({ ...body, link })).toEqual(['link']);
		}
	});

	it('refuses ids that are not ids, and more than 50 people', async () => {
		expect(await problemsOf({ ...body, roomId: 'r00m/../x' })).toEqual(['roomId']);
		expect(await problemsOf({ ...body, roomId: '' })).toEqual(['roomId']);
		expect(await problemsOf({ ...body, snapshotId: 'a b' })).toEqual(['snapshotId']);
		expect(await problemsOf({ ...body, receiverEmployeeIds: ['ben'] })).toEqual(['receiverEmployeeIds']);
		expect(await problemsOf({ ...body, receiverEmployeeIds: [] })).toEqual(['receiverEmployeeIds']);
		expect(await problemsOf({ ...body, receiverEmployeeIds: Array.from({ length: 51 }, () => BEN) })).toEqual([
			'receiverEmployeeIds'
		]);
		expect(await problemsOf({ ...body, organizationId: 'org' })).toEqual(['organizationId']);
		expect(await problemsOf({ ...body, boardName: 'n'.repeat(201) })).toEqual(['boardName']);
	});

	it('never repeats the link in what it answers', async () => {
		const errors = await validate(
			plainToInstance(BoardNotificationDTO, { ...body, link: 'https://ana:secret-key@boards.example/' })
		);
		expect(JSON.stringify(errors.map((error) => error.constraints))).not.toContain('secret-key');
	});
});
