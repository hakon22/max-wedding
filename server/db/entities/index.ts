import { GuestSubmissionDrinkEntity } from '@server/db/entities/guest-submission-drink.entity';
import { GuestSubmissionEntity } from '@server/db/entities/guest-submission.entity';
import { MenuDrinkEntity } from '@server/db/entities/menu-drink.entity';
import { MenuMainCourseEntity } from '@server/db/entities/menu-main-course.entity';
import { UserEntity } from '@server/db/entities/user.entity';
import { WeddingSiteSettingEntity } from '@server/db/entities/wedding-site-setting.entity';

export const entities = [
  UserEntity,
  GuestSubmissionEntity,
  GuestSubmissionDrinkEntity,
  MenuMainCourseEntity,
  MenuDrinkEntity,
  WeddingSiteSettingEntity,
];
