import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Zapier Integrations')
@Controller('zapier')
export class ZapierController {}
