'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DeleteOutlined, EditOutlined, HolderOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, InputNumber, Popconfirm, Space, Switch, Tag, Typography, message } from 'antd';
import { isAxiosError } from 'axios';

import { apiClient } from '@/lib/api-client';
import styles from '@/app/tg-miniapp/menu-admin/telegram-miniapp-menu-admin.module.css';
import type { MenuCatalogDto, MenuItemDto, MenuItemKind } from '@shared/menu-catalog';

const { Text } = Typography;

type AdminCatalogApiResponse = { ok: true } & MenuCatalogDto;

type TelegramWebAppApi = {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
};

type TelegramGlobal = {
  Telegram?: {
    WebApp?: TelegramWebAppApi;
  };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getInitDataFromLocation = (): string | null => {
  const fromSource = (source: string): string | null => {
    const normalized = source.startsWith('#') || source.startsWith('?') ? source.slice(1) : source;
    if (!normalized) {
      return null;
    }
    const params = new URLSearchParams(normalized);
    const raw = params.get('tgWebAppData');
    if (!raw) {
      return null;
    }
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  };
  return fromSource(window.location.hash) ?? fromSource(window.location.search);
};

const resolveTelegramInitData = async (): Promise<string | null> => {
  const timeoutAt = Date.now() + 3500;
  while (Date.now() < timeoutAt) {
    const webApp = (window as unknown as TelegramGlobal).Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
    const direct = webApp?.initData?.trim();
    if (direct) {
      return direct;
    }
    const fromLocation = getInitDataFromLocation();
    if (fromLocation) {
      return fromLocation;
    }
    await sleep(120);
  }
  return getInitDataFromLocation();
};

type MenuKindSectionProps = {
  kind: MenuItemKind;
  title: string;
  items: MenuItemDto[];
  loading: boolean;
  onReorder: (kind: MenuItemKind, items: MenuItemDto[]) => Promise<void>;
  onRename: (kind: MenuItemKind, id: number, labelRu: string) => Promise<void>;
  onToggle: (kind: MenuItemKind, id: number, isActive: boolean) => Promise<void>;
  onDelete: (kind: MenuItemKind, id: number) => Promise<void>;
  onCreate: (kind: MenuItemKind, labelRu: string, order: number) => Promise<void>;
};

const SortableMenuItemRow = ({
  item,
  onRename,
  onToggle,
  onDelete,
  busy,
}: {
  item: MenuItemDto;
  onRename: (id: number, labelRu: string) => Promise<void>;
  onToggle: (id: number, isActive: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  busy: boolean;
}): ReactNode => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id.toString(),
  });
  const [isEditing, setIsEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(item.labelRu);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${styles.itemCard} ${isDragging ? styles.itemCardDragging : ''}`}
      size="small"
    >
      <Flex align="center" gap={8}>
        <Button
          icon={<HolderOutlined />}
          type="text"
          {...attributes}
          {...listeners}
          aria-label={`Переместить ${item.labelRu}`}
        />
        <Tag bordered={false} className={styles.orderTag}>
          #{item.order}
        </Tag>
        <div className={styles.itemMain}>
          {isEditing ? (
            <Space.Compact block>
              <Input
                value={labelDraft}
                onChange={(event) => setLabelDraft(event.target.value)}
                disabled={busy}
                autoFocus
              />
              <Button
                type="primary"
                disabled={busy || labelDraft.trim().length < 2}
                onClick={async () => {
                  await onRename(item.id, labelDraft.trim());
                  setIsEditing(false);
                }}
              >
                Сохранить
              </Button>
            </Space.Compact>
          ) : (
            <Space size={4} wrap>
              <Text strong>{item.labelRu}</Text>
              <Text type="secondary">({item.labelEn})</Text>
            </Space>
          )}
        </div>
        <Switch
          checked={item.isActive}
          disabled={busy}
          checkedChildren="ON"
          unCheckedChildren="OFF"
          onChange={async (checked) => {
            await onToggle(item.id, checked);
          }}
        />
        {!isEditing ? (
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setLabelDraft(item.labelRu);
              setIsEditing(true);
            }}
            disabled={busy}
            aria-label={`Редактировать ${item.labelRu}`}
          />
        ) : (
          <Button onClick={() => setIsEditing(false)} disabled={busy}>
            Отмена
          </Button>
        )}
        <Popconfirm
          title="Удалить позицию?"
          description={item.labelRu}
          okText="Удалить"
          cancelText="Отмена"
          onConfirm={async () => {
            await onDelete(item.id);
          }}
          disabled={busy}
        >
          <Button danger icon={<DeleteOutlined />} disabled={busy} />
        </Popconfirm>
      </Flex>
    </Card>
  );
};

const MenuKindSection = ({
  kind,
  title,
  items,
  loading,
  onReorder,
  onRename,
  onToggle,
  onDelete,
  onCreate,
}: MenuKindSectionProps): ReactNode => {
  const [localItems, setLocalItems] = useState<MenuItemDto[]>(items);
  const [newLabel, setNewLabel] = useState('');
  const [newOrder, setNewOrder] = useState<number>(items.length);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    setLocalItems(items);
    setNewOrder(items.length);
  }, [items]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent): Promise<void> => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const oldIndex = localItems.findIndex((item) => item.id.toString() === active.id);
      const newIndex = localItems.findIndex((item) => item.id.toString() === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }
      const moved = arrayMove(localItems, oldIndex, newIndex).map((item, index) => ({ ...item, order: index }));
      setLocalItems(moved);
      await onReorder(kind, moved);
    },
    [kind, localItems, onReorder],
  );

  return (
    <Card
      title={`${title} (${localItems.length})`}
      loading={loading}
      className={styles.sectionCard}
      extra={<Text type="secondary">Перетаскивайте за иконку</Text>}
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Space.Compact block>
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Новое название"
            disabled={loading}
          />
          <InputNumber
            min={0}
            max={Math.max(0, localItems.length)}
            value={newOrder}
            onChange={(value) => setNewOrder(value ?? 0)}
            disabled={loading}
          />
          <Button
            type="primary"
            disabled={loading || newLabel.trim().length < 2}
            onClick={async () => {
              await onCreate(kind, newLabel.trim(), newOrder);
              setNewLabel('');
              setNewOrder(localItems.length + 1);
            }}
          >
            Добавить
          </Button>
        </Space.Compact>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localItems.map((item) => item.id.toString())} strategy={verticalListSortingStrategy}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {localItems.map((item) => (
                <SortableMenuItemRow
                  key={item.id}
                  item={item}
                  busy={loading}
                  onRename={async (id, labelRu) => onRename(kind, id, labelRu)}
                  onToggle={async (id, isActive) => onToggle(kind, id, isActive)}
                  onDelete={async (id) => onDelete(kind, id)}
                />
              ))}
              {localItems.length === 0 ? <Text type="secondary">Раздел пуст</Text> : null}
            </Space>
          </SortableContext>
        </DndContext>
      </Space>
    </Card>
  );
};

export const TelegramMiniAppMenuAdminClient = (): ReactNode => {
  const [messageApi, contextHolder] = message.useMessage();
  const [token, setToken] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<MenuCatalogDto>({ mainCourses: [], drinks: [] });
  const [loading, setLoading] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  );

  const loadCatalog = useCallback(async (): Promise<void> => {
    if (!authHeaders) {
      return;
    }
    const { data } = await apiClient.get<AdminCatalogApiResponse>('/api/telegram-miniapp/menu', {
      headers: authHeaders,
    });
    setCatalog({ mainCourses: data.mainCourses, drinks: data.drinks });
  }, [authHeaders]);

  useEffect(() => {
    const run = async (): Promise<void> => {
      const initData = await resolveTelegramInitData();
      if (!initData) {
        setBootError('Mini App должен быть открыт через WebApp-кнопку Telegram (/miniapp).');
        return;
      }
      setLoading(true);
      try {
        const authResponse = await apiClient.post<{
          ok: boolean;
          token?: string;
          error?: string;
        }>('/api/telegram-miniapp/auth', { initData });
        if (!authResponse.data.ok || !authResponse.data.token) {
          setBootError(authResponse.data.error ?? 'Не удалось пройти авторизацию');
          return;
        }
        setToken(authResponse.data.token);
      } catch (error) {
        const fallback = 'Ошибка авторизации Mini App';
        if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
          const payload = error.response.data as { error?: string };
          setBootError(payload.error ?? fallback);
          return;
        }
        setBootError(fallback);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    setLoading(true);
    loadCatalog()
      .catch((error) => {
        const fallback = 'Не удалось загрузить каталог';
        if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
          const payload = error.response.data as { error?: string };
          setBootError(payload.error ?? fallback);
          return;
        }
        setBootError(fallback);
      })
      .finally(() => setLoading(false));
  }, [loadCatalog, token]);

  const withBusyState = async (fn: () => Promise<void>): Promise<void> => {
    setLoading(true);
    try {
      await fn();
    } catch (error) {
      const fallback = 'Операция не выполнена';
      if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
        const payload = error.response.data as { error?: string };
        messageApi.error(payload.error ?? fallback);
      } else {
        messageApi.error(fallback);
      }
    } finally {
      setLoading(false);
    }
  };

  if (bootError) {
    return (
      <main className={styles.page}>
        <Card title="Меню администратора" className={styles.mainCard}>
          <Text type="danger">{bootError}</Text>
        </Card>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {contextHolder}
      <Card title="Telegram Mini App: редактор меню" className={styles.mainCard} loading={loading && !token}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">
            Изменения применяются сразу. Если не получается перетащить карточку, потяните за иконку слева.
          </Text>

          <MenuKindSection
            kind="mainCourse"
            title="Основные блюда"
            items={catalog.mainCourses}
            loading={loading}
            onReorder={async (kind, items) =>
              withBusyState(async () => {
                await apiClient.post(
                  '/api/telegram-miniapp/menu/reorder',
                  { kind, orderedIds: items.map((item) => item.id) },
                  { headers: authHeaders },
                );
                await loadCatalog();
                messageApi.success('Порядок обновлён');
              })}
            onRename={async (kind, id, labelRu) =>
              withBusyState(async () => {
                await apiClient.patch(
                  `/api/telegram-miniapp/menu/items/${id}`,
                  { kind, labelRu },
                  { headers: authHeaders },
                );
                await loadCatalog();
                messageApi.success('Название обновлено');
              })}
            onToggle={async (kind, id, isActive) =>
              withBusyState(async () => {
                await apiClient.patch(
                  `/api/telegram-miniapp/menu/items/${id}`,
                  { kind, isActive },
                  { headers: authHeaders },
                );
                await loadCatalog();
              })}
            onDelete={async (kind, id) =>
              withBusyState(async () => {
                await apiClient.delete(`/api/telegram-miniapp/menu/items/${id}`, {
                  params: { kind },
                  headers: authHeaders,
                });
                await loadCatalog();
                messageApi.success('Позиция удалена');
              })}
            onCreate={async (kind, labelRu, order) =>
              withBusyState(async () => {
                await apiClient.post(
                  '/api/telegram-miniapp/menu/items',
                  { kind, labelRu, order },
                  { headers: authHeaders },
                );
                await loadCatalog();
                messageApi.success('Позиция добавлена');
              })}
          />

          <MenuKindSection
            kind="drink"
            title="Напитки"
            items={catalog.drinks}
            loading={loading}
            onReorder={async (kind, items) =>
              withBusyState(async () => {
                await apiClient.post(
                  '/api/telegram-miniapp/menu/reorder',
                  { kind, orderedIds: items.map((item) => item.id) },
                  { headers: authHeaders },
                );
                await loadCatalog();
                messageApi.success('Порядок обновлён');
              })}
            onRename={async (kind, id, labelRu) =>
              withBusyState(async () => {
                await apiClient.patch(
                  `/api/telegram-miniapp/menu/items/${id}`,
                  { kind, labelRu },
                  { headers: authHeaders },
                );
                await loadCatalog();
                messageApi.success('Название обновлено');
              })}
            onToggle={async (kind, id, isActive) =>
              withBusyState(async () => {
                await apiClient.patch(
                  `/api/telegram-miniapp/menu/items/${id}`,
                  { kind, isActive },
                  { headers: authHeaders },
                );
                await loadCatalog();
              })}
            onDelete={async (kind, id) =>
              withBusyState(async () => {
                await apiClient.delete(`/api/telegram-miniapp/menu/items/${id}`, {
                  params: { kind },
                  headers: authHeaders,
                });
                await loadCatalog();
                messageApi.success('Позиция удалена');
              })}
            onCreate={async (kind, labelRu, order) =>
              withBusyState(async () => {
                await apiClient.post(
                  '/api/telegram-miniapp/menu/items',
                  { kind, labelRu, order },
                  { headers: authHeaders },
                );
                await loadCatalog();
                messageApi.success('Позиция добавлена');
              })}
          />
        </Space>
      </Card>
    </main>
  );
};
