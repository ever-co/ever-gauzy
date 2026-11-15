import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsOptional,
	IsString,
	IsUrl,
	IsUUID,
	Length,
	Matches,
	MaxLength
} from 'class-validator';
import { DataSource, In } from 'typeorm';
import {
	EmployeeNotificationTypeEnum,
	ID,
	IEmployeeNotificationBoard,
	IEmployeeNotificationCreateInput
} from '@gauzy/contracts';
import { Employee } from '../core/entities/internal';

/** The most people one request tells about a Board. */
export const MAX_BOARD_NOTIFICATION_RECEIVERS = 50;

/** The longest room or snapshot id taken. */
export const MAX_BOARD_ID_LENGTH = 128;

/** The longest Board name kept. */
export const MAX_BOARD_NAME_LENGTH = 200;

/** The longest link kept. */
export const MAX_BOARD_LINK_LENGTH = 2048;

/** The longest Board name and actor name a title quotes: the title column holds 255 characters on MySQL. */
const MAX_TITLE_BOARD_NAME_LENGTH = 120;
const MAX_ACTOR_NAME_LENGTH = 80;

/** A room or snapshot id: letters, digits, `-` and `_`, as the Boards app makes them. */
const BOARD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The two kinds a Board raises. */
export type BoardNotificationType =
	EmployeeNotificationTypeEnum.BOARD_SHARE | EmployeeNotificationTypeEnum.BOARD_MENTION;

/**
 * What the Boards app sends when a member shares a Board with colleagues or mentions them in one
 * (ever-co/ever-teams#5022): the people, and the Board as the app knows it. A Board is no record of the platform, so
 * it is named by its room or its snapshot, with the name and the link the sender's app chose to send. Nothing of the
 * Board's content: it is end-to-end encrypted, and stays in the Boards app.
 */
export class BoardNotificationDTO {
	@ApiPropertyOptional({
		type: () => String,
		description:
			"The organization the sender and the people work in. Default: the sender's last organization, else the one of the employee their sign-in names."
	})
	@IsOptional()
	@IsUUID()
	readonly organizationId?: ID;

	@ApiProperty({
		type: () => String,
		isArray: true,
		description: `The employees told, at most ${MAX_BOARD_NOTIFICATION_RECEIVERS}.`
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_BOARD_NOTIFICATION_RECEIVERS)
	@IsUUID('all', { each: true })
	readonly receiverEmployeeIds: ID[];

	@ApiPropertyOptional({ type: () => String, description: "The Board's live room. Send this or `snapshotId`." })
	@IsOptional()
	@IsString()
	@Length(1, MAX_BOARD_ID_LENGTH)
	@Matches(BOARD_ID_PATTERN)
	readonly roomId?: string;

	@ApiPropertyOptional({ type: () => String, description: "The Board's saved snapshot. Send this or `roomId`." })
	@IsOptional()
	@IsString()
	@Length(1, MAX_BOARD_ID_LENGTH)
	@Matches(BOARD_ID_PATTERN)
	readonly snapshotId?: string;

	@ApiPropertyOptional({ type: () => String, description: "The Board's name, as the sender sees it." })
	@IsOptional()
	@IsString()
	@MaxLength(MAX_BOARD_NAME_LENGTH)
	readonly boardName?: string;

	@ApiPropertyOptional({
		type: () => String,
		description:
			"The address that opens the Board, kept as sent and never logged. Its `#` part holds the Board's encryption key: send it only when the sender chose to."
	})
	@IsOptional()
	@IsString()
	@MaxLength(MAX_BOARD_LINK_LENGTH)
	@IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false, disallow_auth: true })
	readonly link?: string;
}

/** The sender of a Board notification, as the request's credential names them. */
export interface IBoardNotificationSender {
	userId: ID;
	tenantId: ID;
	/** Their name, for the title. */
	name: string;
	/** The organization they last worked in (their user's `lastOrganizationId`). */
	lastOrganizationId?: ID | null;
	/** The employee their sign-in names. */
	employeeId?: ID | null;
}

/** A name on one line, cut to `max` characters. */
function shortened(name: string | null | undefined, max: number): string {
	const text = (name ?? '').replace(/\s+/g, ' ').trim();
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * How two ids are compared: `IsUUID` takes a UUID in either case, and the database answers with the one it stores.
 */
function idKeyOf(id: ID | null | undefined): string {
	return String(id ?? '').toLowerCase();
}

/** Whether an employee still works: "End Work" deactivates and archives them. */
function isWorking(employee: Pick<Employee, 'isActive' | 'isArchived'>): boolean {
	return employee.isActive !== false && employee.isArchived !== true;
}

/**
 * The Board a request names, as a notification keeps it: its room or its snapshot (one of them, never both), its
 * name on one line, and its link as sent.
 *
 * @throws BadRequestException when the request names neither a room nor a snapshot, or both.
 */
export function boardOf(
	input: Pick<BoardNotificationDTO, 'roomId' | 'snapshotId' | 'boardName' | 'link'>
): IEmployeeNotificationBoard {
	if (!input.roomId === !input.snapshotId) {
		throw new BadRequestException('Name the Board by one of roomId and snapshotId.');
	}
	return {
		...(input.roomId ? { roomId: input.roomId } : { snapshotId: input.snapshotId }),
		name: shortened(input.boardName, MAX_BOARD_NAME_LENGTH) || null,
		link: input.link || null
	};
}

/**
 * Whether a notification's Board (read from its metadata) is this one, at the same link: a share of the same Board
 * at another link (the sender now sends its key, say) is news, the same one again is not.
 */
export function isSameBoard(stored: unknown, board: IEmployeeNotificationBoard): boolean {
	if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
		return false;
	}
	const other = stored as IEmployeeNotificationBoard;
	const sameRef = board.roomId
		? other.roomId === board.roomId
		: !!board.snapshotId && other.snapshotId === board.snapshotId;
	return sameRef && (other.link ?? null) === (board.link ?? null);
}

/**
 * The title of a Board notification, in English as the platform's notification titles are: `Ana shared the Board
 * "Sprint plan" with you`, `Ana mentioned you in the Board "Sprint plan"`, or without the name when none was sent.
 */
export function boardNotificationTitle(
	type: BoardNotificationType,
	actorName: string,
	boardName: string | null | undefined
): string {
	const actor = shortened(actorName, MAX_ACTOR_NAME_LENGTH) || 'Someone';
	const name = shortened(boardName, MAX_TITLE_BOARD_NAME_LENGTH);
	if (type === EmployeeNotificationTypeEnum.BOARD_MENTION) {
		return name ? `${actor} mentioned you in the Board "${name}"` : `${actor} mentioned you in a Board`;
	}
	return name ? `${actor} shared the Board "${name}" with you` : `${actor} shared a Board with you`;
}

/**
 * The notifications of a Board shared or of a mention in one: one of the kind for each employee named who works in
 * the organization, never for the sender, each once. The sender must work in that organization too: the one the
 * request names, else the one they last worked in, else the one of the employee their sign-in names. The people
 * named who do not work there (another organization, another tenant, no longer working, unknown) are left out.
 *
 * @param dataSource The database the employees are read from.
 * @param type `BoardShare` or `BoardMention`.
 * @param input The people and the Board.
 * @param sender The sender, as the request's credential names them.
 * @throws BadRequestException when the request names neither a room nor a snapshot, or both; ForbiddenException
 * when the sender works in no organization the request may use.
 */
export async function boardNotificationsOf(
	dataSource: DataSource,
	type: BoardNotificationType,
	input: BoardNotificationDTO,
	sender: IBoardNotificationSender
): Promise<IEmployeeNotificationCreateInput[]> {
	const board = boardOf(input);
	const employees = dataSource.getRepository(Employee);
	const own = (
		await employees.find({
			select: { id: true, organizationId: true, isActive: true, isArchived: true },
			where: { userId: sender.userId, tenantId: sender.tenantId }
		})
	).filter(isWorking);
	const inOrganization = (organizationId: ID | null | undefined) =>
		organizationId
			? own.find((employee) => idKeyOf(employee.organizationId) === idKeyOf(organizationId))
			: undefined;
	const senderEmployee = input.organizationId
		? inOrganization(input.organizationId)
		: (inOrganization(sender.lastOrganizationId) ??
			own.find((employee) => !!sender.employeeId && idKeyOf(employee.id) === idKeyOf(sender.employeeId)));
	if (!senderEmployee) {
		throw new ForbiddenException('Only an employee of the organization can tell its people about a Board.');
	}
	const senderKey = idKeyOf(senderEmployee.id);
	const named = [...new Set(input.receiverEmployeeIds.map(idKeyOf))].filter((key) => key !== senderKey);
	if (named.length === 0) {
		return [];
	}
	// The ids as sent and in lower case: the case the database stores them in
	const found = await employees.find({
		select: { id: true, isActive: true, isArchived: true },
		where: {
			id: In([...new Set([...input.receiverEmployeeIds, ...named])]),
			organizationId: senderEmployee.organizationId,
			tenantId: sender.tenantId
		}
	});
	const working = new Map(found.filter(isWorking).map((employee) => [idKeyOf(employee.id), employee.id] as const));
	const title = boardNotificationTitle(type, sender.name, board.name);
	return named
		.filter((key) => working.has(key))
		.map((key) => ({
			type,
			title,
			// A Board is no record of the platform: the notification names it in its metadata
			entity: null,
			entityId: null,
			metadata: { board },
			receiverEmployeeId: working.get(key) as ID,
			sentByEmployeeId: senderEmployee.id,
			organizationId: senderEmployee.organizationId,
			tenantId: sender.tenantId
		}));
}
