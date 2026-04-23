/** Команды в меню для гостей (scope default — у кого нет своего scope `chat`) */
export const TELEGRAM_BOT_COMMANDS_FOR_GUESTS = [
  { command: 'start', description: 'Старт' },
] as const;

/** Меню для пользователей с ролью ADMIN (в личке — scope `chat` с chat_id пользователя) */
export const TELEGRAM_BOT_COMMANDS_FOR_ADMINS = [
  { command: 'start', description: 'Старт' },
  { command: 'list', description: 'Последние заявки' },
  { command: 'last', description: 'Последняя заявка' },
  { command: 'summary', description: 'Сводка по анкетам' },
  { command: 'export', description: 'Выгрузка в Excel' },
] as const;
