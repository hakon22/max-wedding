import { Container, Singleton } from 'typescript-ioc';

import { MenuDrinkEntity } from '@server/db/entities/menu-drink.entity';
import { MenuMainCourseEntity } from '@server/db/entities/menu-main-course.entity';
import { BaseService } from '@server/services/app/base-service';
import { MenuTranslateService } from '@server/services/menu/menu-translate.service';
import type { MenuCatalogDto, MenuItemDto, MenuItemKind } from '@shared/menu-catalog';

type MenuEntity = MenuMainCourseEntity | MenuDrinkEntity;

type MenuUpdateInput = Partial<{
  labelRu: string;
  order: number;
  isActive: boolean;
}>;

export class MenuCatalogValidationError extends Error {}

@Singleton
export class MenuCatalogService extends BaseService {
  private readonly menuTranslateService = Container.get(MenuTranslateService);

  private mapToDto = (item: MenuEntity): MenuItemDto => ({
    id: item.id,
    labelRu: item.labelRu,
    labelEn: item.labelEn,
    order: item.order,
    isActive: item.isActive,
  });

  private getRepository = (kind: MenuItemKind) => {
    const dataSource = this.databaseService.getDataSource();
    return kind === 'mainCourse'
      ? dataSource.getRepository(MenuMainCourseEntity)
      : dataSource.getRepository(MenuDrinkEntity);
  };

  private validateLabel = (label: string): void => {
    const trimmed = label.trim();
    if (trimmed.length < 2 || trimmed.length > 120) {
      throw new MenuCatalogValidationError('Название должно быть от 2 до 120 символов');
    }
  };

  private validateOrder = (value: number): void => {
    if (!Number.isInteger(value)) {
      throw new MenuCatalogValidationError('order должен быть целым числом');
    }
    if (value < 0) {
      throw new MenuCatalogValidationError('order должен быть больше или равен 0');
    }
  };

  private normalizeOrders = async (kind: MenuItemKind): Promise<void> => {
    const repository = this.getRepository(kind);
    const rows = await repository.find({
      order: { order: 'ASC', id: 'ASC' },
    });
    rows.forEach((row, index) => {
      row.order = index;
    });
    if (rows.length > 0) {
      await repository.save(rows);
    }
  };

  private moveItemToOrder = async (kind: MenuItemKind, id: number, desiredOrder: number): Promise<void> => {
    const repository = this.getRepository(kind);
    const rows = await repository.find({
      order: { order: 'ASC', id: 'ASC' },
    });
    const currentIndex = rows.findIndex((row) => row.id === id);
    if (currentIndex < 0) {
      return;
    }
    const [movingRow] = rows.splice(currentIndex, 1);
    const targetIndex = Math.min(Math.max(desiredOrder, 0), rows.length);
    rows.splice(targetIndex, 0, movingRow);
    rows.forEach((row, index) => {
      row.order = index;
    });
    await repository.save(rows);
  };

  public listCatalog = async (activeOnly: boolean): Promise<MenuCatalogDto> => {
    const [mainCourses, drinks] = await Promise.all([
      this.listByKind('mainCourse', activeOnly),
      this.listByKind('drink', activeOnly),
    ]);
    return { mainCourses, drinks };
  };

  public listByKind = async (kind: MenuItemKind, activeOnly: boolean): Promise<MenuItemDto[]> => {
    const repository = this.getRepository(kind);
    const items = await repository.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: { order: 'ASC', id: 'ASC' },
    });
    return items.map(this.mapToDto);
  };

  public createMenuItem = async (
    kind: MenuItemKind,
    payload: { labelRu: string; order: number; isActive?: boolean },
  ): Promise<MenuItemDto> => {
    const labelRu = payload.labelRu.trim();
    const labelEn = await this.menuTranslateService.translateRuToEn(labelRu);
    this.validateLabel(labelRu);
    this.validateLabel(labelEn);
    this.validateOrder(payload.order);
    const repository = this.getRepository(kind);
    const duplicate = await repository.findOne({ where: { labelRu } });
    if (duplicate) {
      throw new MenuCatalogValidationError(`Позиция "${labelRu}" уже существует`);
    }
    const entity = repository.create({
      labelRu,
      labelEn,
      order: 0,
      isActive: payload.isActive ?? true,
    });
    const saved = await repository.save(entity);
    await this.moveItemToOrder(kind, saved.id, payload.order);
    const updated = await repository.findOneOrFail({ where: { id: saved.id } });
    return this.mapToDto(updated);
  };

  public updateMenuItem = async (kind: MenuItemKind, id: number, updates: MenuUpdateInput): Promise<MenuItemDto> => {
    if (!Number.isInteger(id) || id <= 0) {
      throw new MenuCatalogValidationError('Некорректный id');
    }
    const repository = this.getRepository(kind);
    const entity = await repository.findOne({ where: { id } });
    if (!entity) {
      throw new MenuCatalogValidationError('Позиция не найдена');
    }
    if (updates.labelRu !== undefined) {
      const labelRu = updates.labelRu.trim();
      this.validateLabel(labelRu);
      const duplicate = await repository.findOne({ where: { labelRu } });
      if (duplicate && duplicate.id !== entity.id) {
        throw new MenuCatalogValidationError(`Позиция "${labelRu}" уже существует`);
      }
      entity.labelRu = labelRu;
      entity.labelEn = await this.menuTranslateService.translateRuToEn(entity.labelRu);
    }
    const requestedOrder = updates.order;
    if (requestedOrder !== undefined) {
      this.validateOrder(requestedOrder);
    }
    if (updates.isActive !== undefined) {
      entity.isActive = updates.isActive;
    }
    const saved = await repository.save(entity);
    if (requestedOrder !== undefined) {
      await this.moveItemToOrder(kind, saved.id, requestedOrder);
      const updated = await repository.findOneOrFail({ where: { id: saved.id } });
      return this.mapToDto(updated);
    }
    return this.mapToDto(saved);
  };

  public deleteMenuItem = async (kind: MenuItemKind, id: number): Promise<void> => {
    const repository = this.getRepository(kind);
    const target = await repository.findOne({ where: { id } });
    if (!target) {
      throw new MenuCatalogValidationError('Позиция не найдена');
    }
    await repository.remove(target);
    await this.normalizeOrders(kind);
  };

  public toggleMenuItemActive = async (kind: MenuItemKind, id: number): Promise<MenuItemDto> => {
    const repository = this.getRepository(kind);
    const target = await repository.findOne({ where: { id } });
    if (!target) {
      throw new MenuCatalogValidationError('Позиция не найдена');
    }
    target.isActive = !target.isActive;
    const saved = await repository.save(target);
    return this.mapToDto(saved);
  };

  public ensureValidSelection = async (mainCourseId: number, drinkIds: number[]): Promise<void> => {
    if (!Number.isInteger(mainCourseId) || mainCourseId <= 0) {
      throw new MenuCatalogValidationError('Выбрано недопустимое основное блюдо');
    }
    if (!drinkIds.every((drinkId) => Number.isInteger(drinkId) && drinkId > 0)) {
      throw new MenuCatalogValidationError('Выбран недопустимый напиток');
    }
    const [mainCourseRows, drinkRows] = await Promise.all([
      this.getRepository('mainCourse').find({ where: { isActive: true } }),
      this.getRepository('drink').find({ where: { isActive: true } }),
    ]);
    const mainCourseIdSet = new Set(mainCourseRows.map((row) => row.id));
    const drinkIdSet = new Set(drinkRows.map((row) => row.id));
    if (!mainCourseIdSet.has(mainCourseId)) {
      throw new MenuCatalogValidationError('Выбрано недопустимое основное блюдо');
    }
    for (const drinkId of drinkIds) {
      if (!drinkIdSet.has(drinkId)) {
        throw new MenuCatalogValidationError('Выбран недопустимый напиток');
      }
    }
  };

  public getLabelMaps = async (): Promise<{
    mainCourseLabelById: Record<number, string>;
    drinkLabelById: Record<number, string>;
  }> => {
    const [mainCourses, drinks] = await Promise.all([
      this.listByKind('mainCourse', false),
      this.listByKind('drink', false),
    ]);
    return {
      mainCourseLabelById: Object.fromEntries(mainCourses.map((row) => [row.id, row.labelRu])),
      drinkLabelById: Object.fromEntries(drinks.map((row) => [row.id, row.labelRu])),
    };
  };
}
