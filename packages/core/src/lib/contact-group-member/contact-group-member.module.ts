import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ContactGroupModule } from '../contact-group/contact-group.module';
import { ContactGroupMember } from './contact-group-member.entity';
import { ContactGroupMemberService } from './contact-group-member.service';
import { ContactGroupMemberController } from './contact-group-member.controller';
import { ContactGroupMemberResolver } from './contact-group-member.resolver';
import { TypeOrmContactGroupMemberRepository } from './repository/type-orm-contact-group-member.repository';
import { MikroOrmContactGroupMemberRepository } from './repository/mikro-orm-contact-group-member.repository';

/**
 * Group membership: who is in which group, until when, and who put them there.
 *
 * **Both ORMs are registered**, for the reason the group module states: the kernel is dual-ORM and each
 * repository pair belongs with the module that declares its table.
 *
 * **`ContactGroupModule` is imported because the write has to ask about the group.** Does it exist
 * inside the caller's scope, and does its kind allow a hand-written membership at all? The dependency
 * runs one way — the group service never reads membership — so no cycle is created, and the group's
 * member count is answered by this module's service to whoever asks rather than by a collection on the
 * group row.
 *
 * **The membership routes and the membership field resolvers are declared here rather than beside the
 * group**, and that is the same one-way dependency read the other way round: this module can reach both
 * services, while the group module cannot reach this one without closing a cycle. So the routes that
 * hang off `/contact-groups/:id/members`, and the `members` / `memberCount` fields of the group type,
 * are answered from here — by the service that owns the pivot, and not by a row count over its table,
 * because a membership whose window has closed is absent to every reader.
 *
 * **`RolePermissionModule` is imported for the guards**, so that this module — which hosts the
 * membership controller and resolver — can reach the permission lookup they inject.
 *
 * **The announcement path is imported, not declared here.** `ContactGroupModule` provides and exports
 * `ContactGroupEventPublisher`, and this module already imports it, so the membership service injects
 * the same publisher the group's own writes announce through. Declaring a second one here would mean
 * two publishers over one catalogue and two announcement paths over one fact — and it is the same
 * one-way dependency that decides where the routes and the field resolvers live.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ContactGroupMember]),
		MikroOrmModule.forFeature([ContactGroupMember]),
		ContactGroupModule,
		RolePermissionModule
	],
	controllers: [ContactGroupMemberController],
	providers: [
		ContactGroupMemberService,
		ContactGroupMemberResolver,
		TypeOrmContactGroupMemberRepository,
		MikroOrmContactGroupMemberRepository
	],
	exports: [
		ContactGroupMemberService,
		ContactGroupMemberResolver,
		TypeOrmContactGroupMemberRepository,
		MikroOrmContactGroupMemberRepository
	]
})
export class ContactGroupMemberModule {}
