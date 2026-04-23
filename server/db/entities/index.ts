import { GuestSubmissionDrinkEntity } from '@server/db/entities/guest-submission-drink.entity';
import { GuestSubmissionEntity } from '@server/db/entities/guest-submission.entity';
import { UserEntity } from '@server/db/entities/user.entity';

export const entities = [
  UserEntity,
  GuestSubmissionEntity,
  GuestSubmissionDrinkEntity,
];
