import { of, Subject, throwError } from 'rxjs';
import { ChatMemberRoleEnum, IChatMemberSummary } from '@gauzy/contracts';
import { ChatMemberPreview, ChatMemberPreviewSource, membersKey } from './chat-member-preview';

const member = (employeeId: string): IChatMemberSummary => ({ employeeId, userId: `u-${employeeId}`, role: ChatMemberRoleEnum.MEMBER });
const ids = (members: readonly IChatMemberSummary[]) => members.map((item) => String(item.employeeId));
const channel = (id: string, memberCount: number, members?: IChatMemberSummary[]): ChatMemberPreviewSource =>
	({ id, memberCount, ...(members ? { members } : {}) }) as ChatMemberPreviewSource;

describe('membersKey', () => {
	it('names a conversation at one member count', () => {
		expect(membersKey({ id: 'c1', memberCount: 3 } as ChatMemberPreviewSource)).toBe('c1:3');
	});
});

describe('ChatMemberPreview', () => {
	it('reads the members of a channel listed without them, once per member count', () => {
		const read = jest.fn(() => of([member('a'), member('b'), member('c')]));
		const preview = new ChatMemberPreview(read);
		const open = channel('c1', 3);
		preview.follow(open, true, () => open);
		preview.follow(open, true, () => open);
		expect(read).toHaveBeenCalledTimes(1);
		expect(ids(preview.members(open))).toEqual(['a', 'b', 'c']);
	});

	it('uses the members a conversation came with, and reads nothing for them', () => {
		const read = jest.fn(() => of([]));
		const preview = new ChatMemberPreview(read);
		const open = channel('d1', 2, [member('a'), member('b')]);
		preview.follow(open, true, () => open);
		expect(read).not.toHaveBeenCalled();
		expect(ids(preview.members(open))).toEqual(['a', 'b']);
	});

	it('does not show a removed member again after the list refreshes the channel without its members', () => {
		const read = jest.fn(() => of([member('a'), member('b'), member('c')]));
		const preview = new ChatMemberPreview(read);
		let open = channel('c1', 3);
		preview.follow(open, true, () => open);
		// The settings dialog removed "c" and handed back the conversation read again, with its members.
		open = channel('c1', 2, [member('a'), member('b')]);
		preview.follow(open, true, () => open);
		// The next list refresh brings the channel without members again, at its new count.
		open = channel('c1', 2);
		preview.follow(open, true, () => open);
		expect(ids(preview.members(open))).toEqual(['a', 'b']);
		expect(read).toHaveBeenCalledTimes(1);
	});

	it('reads the members again when the count changed without them (someone left elsewhere)', () => {
		const read = jest.fn().mockReturnValueOnce(of([member('a'), member('b'), member('c')])).mockReturnValueOnce(of([member('a'), member('b')]));
		const preview = new ChatMemberPreview(read);
		let open = channel('c1', 3);
		preview.follow(open, true, () => open);
		open = channel('c1', 2);
		preview.follow(open, true, () => open);
		expect(read).toHaveBeenCalledTimes(2);
		expect(ids(preview.members(open))).toEqual(['a', 'b']);
	});

	it('reads again on a return after its answer was dropped for another conversation', () => {
		const first = new Subject<IChatMemberSummary[]>();
		const read = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(of([member('b')])).mockReturnValueOnce(of([member('a')]));
		const preview = new ChatMemberPreview(read);
		const a = channel('c1', 1);
		const b = channel('c2', 1);
		let open = a;
		preview.follow(a, true, () => open);
		open = b;
		preview.follow(b, true, () => open);
		// The answer for c1 comes while c2 is open: dropped.
		first.next([member('a')]);
		first.complete();
		expect(preview.members(a)).toEqual([]);
		open = a;
		preview.follow(a, true, () => open);
		expect(read).toHaveBeenCalledTimes(3);
		expect(ids(preview.members(a))).toEqual(['a']);
	});

	it('reads again on a later visit after a read failed', () => {
		const read = jest.fn().mockReturnValueOnce(throwError(() => new Error('offline'))).mockReturnValueOnce(of([member('a')]));
		const preview = new ChatMemberPreview(read);
		const open = channel('c1', 1);
		preview.follow(open, true, () => open);
		expect(preview.members(open)).toEqual([]);
		preview.follow(open, true, () => open);
		expect(read).toHaveBeenCalledTimes(2);
		expect(ids(preview.members(open))).toEqual(['a']);
	});

	it('asks once while a read for the open conversation is under way', () => {
		const pending = new Subject<IChatMemberSummary[]>();
		const read = jest.fn(() => pending);
		const preview = new ChatMemberPreview(read);
		const open = channel('c1', 1);
		preview.follow(open, true, () => open);
		preview.follow(open, true, () => open);
		expect(read).toHaveBeenCalledTimes(1);
	});

	it('shows no faces once the conversation has nobody in it, and forgets the ones it had', () => {
		const read = jest.fn(() => of([member('a')]));
		const preview = new ChatMemberPreview(read);
		let open = channel('c1', 1);
		preview.follow(open, true, () => open);
		expect(ids(preview.members(open))).toEqual(['a']);
		open = channel('c1', 0, []);
		preview.follow(open, true, () => open);
		expect(preview.members(open)).toEqual([]);
		// The same channel at a count again shows nothing stale before its members are read.
		expect(preview.members(channel('c1', 1))).toEqual([]);
	});

	it('drops a read under way once newer members came with the conversation at the same count', () => {
		const pending = new Subject<IChatMemberSummary[]>();
		const read = jest.fn(() => pending);
		const preview = new ChatMemberPreview(read);
		let open = channel('c1', 2);
		preview.follow(open, true, () => open);
		// The settings dialog swapped a member and handed back the conversation with its members (same count).
		open = channel('c1', 2, [member('a'), member('new')]);
		preview.follow(open, true, () => open);
		// The older read answers last, with the members as they were.
		pending.next([member('a'), member('old')]);
		pending.complete();
		// A list refresh without members keeps the newer ones.
		open = channel('c1', 2);
		preview.follow(open, true, () => open);
		expect(ids(preview.members(open))).toEqual(['a', 'new']);
		expect(read).toHaveBeenCalledTimes(1);
	});

	it('keeps the latest read when two reads of the same conversation and count finish out of order', () => {
		const first = new Subject<IChatMemberSummary[]>();
		const second = new Subject<IChatMemberSummary[]>();
		const read = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(of([member('b')])).mockReturnValueOnce(second);
		const preview = new ChatMemberPreview(read);
		const a = channel('c1', 1);
		const b = channel('c2', 1);
		let open = a;
		preview.follow(a, true, () => open);
		open = b;
		preview.follow(b, true, () => open);
		open = a;
		preview.follow(a, true, () => open);
		expect(read).toHaveBeenCalledTimes(3);
		second.next([member('newer')]);
		second.complete();
		// The first read of c1 answers last: it is outdated.
		first.next([member('older')]);
		first.complete();
		expect(ids(preview.members(a))).toEqual(['newer']);
	});

	it('reads nothing for someone who is not a member, or for an empty conversation', () => {
		const read = jest.fn(() => of([member('a')]));
		const preview = new ChatMemberPreview(read);
		preview.follow(channel('c1', 3), false, () => channel('c1', 3));
		preview.follow(channel('c2', 0), true, () => channel('c2', 0));
		expect(read).not.toHaveBeenCalled();
	});
});
