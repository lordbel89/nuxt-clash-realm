import type { NavigationMenuItem } from '@nuxt/ui';

const uiForParent = {
  linkLeadingIcon: 'text-accent',
};
const uiForChild = {
  linkLeadingIcon: 'text-primary',
};

export const sideMenuDecorator = (sideMenu: NavigationMenuItem[][]): NavigationMenuItem[][] => sideMenu?.map(section => {
  return section.map(parentItem => {
    if (!parentItem.children) {
      return { ...parentItem, ui: uiForParent };
    }
    return {
      ...parentItem,
      ui: uiForParent,
      children: parentItem.children
        .map(childItem => ({
          ...childItem,
          ui: uiForChild,
        })) };
  });
}) ?? [];