import type { ReactNode } from 'react';

import { TelegramMiniAppMenuAdminClient } from '@/app/tg-miniapp/menu-admin/telegram-miniapp-menu-admin.client';

export const dynamic = 'force-dynamic';

const TelegramMiniAppMenuAdminPage = (): ReactNode => <TelegramMiniAppMenuAdminClient />;

export default TelegramMiniAppMenuAdminPage;
