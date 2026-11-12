# Implementation Plan: Comments and trash (platform part)

**Feature ID**: `comments-and-trash`
**Tasks**: `./tasks.md`
**Client spec**: ever-teams `docs/specs/features/comments-and-trash/spec.md` (behaviour, flows, acceptance)
**Status**: `In review`
**Last updated**: 2026-11-11

## Why the platform changes at all

The comment, reaction and soft-delete APIs exist, but three things kept both UIs from using them:

1. **Reactions could not be counted.** `GET /reaction` is employee-scoped like every per-employee table: a caller
   without `CHANGE_SELECTED_EMPLOYEE` reads their own reactions only, so a client cannot show "3 people reacted".
   Nothing checked that the reacting caller may read the comment either.
2. **Nothing said a comment was edited.** `editedAt` was a column a body could set to anything; the server never
   stamped it.
3. **A deleted task could not be found again.** No route lists soft-deleted tasks, and the inherited soft-delete and
   restore routes ran under the class-level `ALL_ORG_EDIT` alone, while a hard delete admits `ORG_TASK_DELETE`
   holders and team managers. A trash that only administrators can fill or empty is no trash.

## Changes

### Reactions on comments

- `GET /reaction/comments?entity=<record type>&entityId=<record>`: the reactions on the comments of one record,
  grouped by comment and emoji: `{ entity: 'Comment', entityId, emoji, count, reactedByMe, reactionId?, reactors }`,
  reactors `{ employeeId, name, imageUrl }` in the order they reacted. The comments are read through
  `CommentService.find` (the comment list's own rules, governed records included), so the summary covers exactly the
  comments the caller can list; the reactions of those comments are then read across reactors. Chat reactions never
  appear (the chat API owns them).
- `POST /reaction` on a `Comment` first reads the comment as the caller (`findReadableById`): reacting to a comment
  you cannot read is a 404, not a silent write.
- After a comment's reaction is added, toggled off, deleted, withdrawn or restored, `CommentService` publishes
  `CommentEvent('updated')` for that comment. The real-time channel already turns it into a `comment.updated` hint
  addressed to the record's readers, so a client that listens refetches comments and reactions; nothing new is sent
  and the hint carries no content.

### Comment edits

- `editedAt` is the server's: a body's value is ignored, and an update that changes the text stamps it with the
  current time. Resolving or reopening does not mark a comment edited.

### Task trash (`GAUZY_TASK_TRASH_ENABLED`, default off)

- `GET /tasks/trash?organizationId=&organizationTeamId=&projectId=&search=&skip=&take=`: soft-deleted tasks, most
  recently deleted first, with `project`, `teams`, `members.user`, `deletedByUser`. Answers 404 unless the flag is
  exactly `true` (the probe a client uses, as `GAUZY_TASK_VIEWS_ENABLED`).
  - `ALL_ORG_EDIT` or `ORG_TASK_DELETE`: the organization's trash, optionally kept to a team or a project.
  - `ORG_TASK_EDIT` alone: the trash of a team the caller manages, named by `organizationTeamId` (403 otherwise).
- `DELETE /tasks/:id/soft` (move to trash) and `PUT /tasks/:id/recover` (restore) now run under the hard delete's
  grants (`ALL_ORG_EDIT`, `ORG_TASK_DELETE`, or `ORG_TASK_EDIT` for a manager of one of the task's teams), REST and
  GraphQL alike. They are not behind the flag: they existed before.
- Restoring publishes `TaskEvent` `UPDATED`, so the real-time hint and the integrations that mirror tasks see the
  task again (a soft delete already published `DELETED`).
- `DELETE /tasks/:id` (delete permanently) also finds a task that is in the trash, for a team manager too, and
  publishes `DELETED` only when the task was live (the trash already published it once).
- `DELETE /tasks/:id/trashed?organizationId=` (Delete forever, the trash
  pages' action): deletes a task for good only while it is in the trash.
  - One `DELETE` decides it, on both ORMs: its WHERE has the task, the
    caller's tenant, the stated organization and `deletedAt IS NOT NULL`.
    Nothing is read first to decide it.
  - A task that is not there answers 404 and is left as it is: restored by
    someone since the trash was read, already deleted, live, or another
    tenant's or organization's. The trash pages had called `DELETE /tasks/:id`,
    which deleted a restored, live task for good.
  - A task that a linked issue or a key result still points at (foreign keys
    with no delete rule) is refused by the database: 409, and it stays.
  - Same grants and team-manager check as the restore, behind the flag. No
    `DELETED` event: the task published it when it went to the trash.

## Not changed

- No table, column or migration. No new permission.
- Who may edit or delete a comment (`assertMayManage`, owner decision 5 of 2026-10-13) is unchanged.
- Task comments stay employee-scoped for callers without `CHANGE_SELECTED_EMPLOYEE` (they list their own comments
  only). That is the platform's existing rule for per-employee rows; the reaction summary follows it rather than
  widening it. Reported in the PR for the owner.
- Parent-task automation is another lane.
