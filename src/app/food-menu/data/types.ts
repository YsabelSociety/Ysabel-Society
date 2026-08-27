export type MenuCategory = "FOOD" | "DESSERTS" | "DRINKS" | "WINE LIST";
export type GardenMenuCategory = "DAY MENU" | "EVENING MENU" | "DRINKS MENU";

export interface MenuItem {
    name: string;
    description: string;
    price: string;
}

export interface FoodSubcategory {
    title: string;
    items: MenuItem[];
}

export type MenuItemsData = {
    FOOD: FoodSubcategory[];
    DESSERTS: MenuItem[];
    DRINKS: FoodSubcategory[] | MenuItem[];
    "WINE LIST": FoodSubcategory[] | MenuItem[];
};

export type GardenMenuItemsData = {
    "DAY MENU": (MenuItem | FoodSubcategory)[];
    "EVENING MENU": MenuItem[];
    "DRINKS MENU": FoodSubcategory[] | MenuItem[];
};

export const menuCategories: MenuCategory[] = ["FOOD", "DESSERTS", "DRINKS", "WINE LIST"];
export const gardenMenuCategories: GardenMenuCategory[] = ["DAY MENU", "EVENING MENU", "DRINKS MENU"];

