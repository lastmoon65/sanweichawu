import { IsInt, Min } from 'class-validator';

export class CloseDiningSessionDto {
  @IsInt()
  @Min(1)
  version!: number;
}
