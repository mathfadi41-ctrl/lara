import { ApiProperty } from '@nestjs/swagger';
import type { Role } from '@prisma/client';

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['Admin', 'Operator', 'Viewer'] })
  role!: Role;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
