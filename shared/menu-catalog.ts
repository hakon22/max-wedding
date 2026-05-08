export type MenuItemKind = 'mainCourse' | 'drink';

export type MenuItemDto = {
  id: number;
  labelRu: string;
  labelEn: string;
  order: number;
  isActive: boolean;
};

export type MenuCatalogDto = {
  mainCourses: MenuItemDto[];
  drinks: MenuItemDto[];
};
