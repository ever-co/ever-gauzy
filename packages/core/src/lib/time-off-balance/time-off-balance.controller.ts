import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination, ITimeOffBalance, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UseValidationPipe } from './../shared/pipes';
import {
	AdjustTimeOffBalanceDTO,
	AllocateTimeOffBalanceDTO,
	CarryForwardTimeOffBalanceDTO,
	TimeOffBalanceQueryDTO
} from './dto';
import { TimeOffBalanceService } from './time-off-balance.service';

/**
 * Leave balances per employee, per policy, per year (issue #314).
 *
 * `GET /time-off-balance` and `GET /time-off-balance/me` are the two routes the MCP server's
 * `get_time_off_balance` and `get_my_time_off_balance` tools already call — until now they 404.
 *
 * Reading needs the Time Off view permission, and a caller without `CHANGE_SELECTED_EMPLOYEE`
 * only ever sees their own balances. Changing one needs the Time Off edit permission, because an
 * allocation decides how much leave somebody may take.
 */
@ApiTags('TimeOffBalance')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
@Controller('/time-off-balance')
export class TimeOffBalanceController {
	constructor(private readonly timeOffBalanceService: TimeOffBalanceService) {}

	/**
	 * The current employee's own leave balances.
	 *
	 * @param options the policy and year to filter by
	 * @returns the caller's balances
	 */
	@ApiOperation({ summary: "Find the current employee's leave balances" })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found leave balances' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW)
	@Get('/me')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findMine(@Query() options: TimeOffBalanceQueryDTO): Promise<IPagination<ITimeOffBalance>> {
		return this.timeOffBalanceService.findMine(options);
	}

	/**
	 * List leave balances, optionally narrowed by employee, policy and year.
	 *
	 * @param options the filters to apply
	 * @returns the matching balances
	 */
	@ApiOperation({ summary: 'Find leave balances' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found leave balances' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW)
	@Get('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() options: TimeOffBalanceQueryDTO): Promise<IPagination<ITimeOffBalance>> {
		return this.timeOffBalanceService.findAllByFilter(options);
	}

	/**
	 * Set the accrued days of one employee/policy/year balance.
	 *
	 * @param input employee, policy, year and the accrued days
	 * @returns the updated balance
	 */
	@ApiOperation({ summary: 'Allocate accrued leave days' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The balance has been allocated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Employee or policy not found' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	@Post('/allocate')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async allocate(@Body() input: AllocateTimeOffBalanceDTO): Promise<ITimeOffBalance> {
		return this.timeOffBalanceService.allocate(input);
	}

	/**
	 * Spend days from a balance, e.g. when a time off request is approved.
	 *
	 * @param input employee, policy, year and how many days to deduct
	 * @returns the balance after the deduction
	 */
	@ApiOperation({ summary: 'Deduct leave days from a balance' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The balance has been deducted.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Insufficient leave balance' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	@Post('/deduct')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async deduct(@Body() input: AdjustTimeOffBalanceDTO): Promise<ITimeOffBalance> {
		return this.timeOffBalanceService.deduct(input);
	}

	/**
	 * Give days back to a balance, e.g. when an approved request is cancelled.
	 *
	 * @param input employee, policy, year and how many days to restore
	 * @returns the balance after the reversal
	 */
	@ApiOperation({ summary: 'Restore leave days to a balance' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The balance has been restored.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Balance not found' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	@Post('/reverse')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async reverse(@Body() input: AdjustTimeOffBalanceDTO): Promise<ITimeOffBalance> {
		return this.timeOffBalanceService.reverse(input);
	}

	/**
	 * Roll unused days of one policy from one year into the next.
	 *
	 * @param input policy, source year, target year and an optional cap
	 * @returns how many employee balances were rolled over
	 */
	@ApiOperation({ summary: 'Carry unused leave days forward into the next year' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The balances have been carried forward.' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	@Post('/carry-forward')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async carryForward(@Body() input: CarryForwardTimeOffBalanceDTO): Promise<{ carried: number }> {
		return this.timeOffBalanceService.carryForward(input);
	}
}
