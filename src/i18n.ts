export type Language = "en" | "ru" | "uz";

const copy = {
  en: {
    discover: "Discover", liked: "Liked", basket: "Basket", profile: "Profile",
    search: "Search artworks or artists", all: "All", available: "Available",
    viewWall: "View on my wall", addBasket: "Add to basket", added: "Added",
    by: "by", artworks: "artworks", editProfile: "Edit profile", artistStudio: "Artist studio",
    admin: "Admin dashboard", savedViews: "Saved wall views", emptyLikes: "Your liked artworks will appear here.",
    emptyBasket: "Your basket is waiting for something beautiful.", total: "Estimated total",
    share: "Share", save: "Save view", liveCamera: "Live camera", uploadRoom: "Upload room photo",
    back: "Back", filters: "Filters", newest: "Newest", popular: "Popular", priceLow: "Price: low first",
  },
  ru: {
    discover: "Обзор", liked: "Избранное", basket: "Корзина", profile: "Профиль",
    search: "Поиск картин или художников", all: "Все", available: "В наличии",
    viewWall: "Посмотреть на стене", addBasket: "В корзину", added: "Добавлено",
    by: "автор", artworks: "работ", editProfile: "Изменить профиль", artistStudio: "Студия художника",
    admin: "Панель администратора", savedViews: "Сохранённые виды", emptyLikes: "Здесь появятся понравившиеся работы.",
    emptyBasket: "Ваша корзина пока пуста.", total: "Предварительная сумма",
    share: "Поделиться", save: "Сохранить вид", liveCamera: "Камера", uploadRoom: "Загрузить фото комнаты",
    back: "Назад", filters: "Фильтры", newest: "Новинки", popular: "Популярные", priceLow: "Сначала дешевле",
  },
  uz: {
    discover: "Kashf etish", liked: "Yoqtirganlar", basket: "Savat", profile: "Profil",
    search: "Asar yoki rassomni qidiring", all: "Barchasi", available: "Sotuvda",
    viewWall: "Devorimda ko'rish", addBasket: "Savatga qo'shish", added: "Qo'shildi",
    by: "rassom", artworks: "asar", editProfile: "Profilni tahrirlash", artistStudio: "Rassom studiyasi",
    admin: "Admin paneli", savedViews: "Saqlangan ko'rinishlar", emptyLikes: "Yoqtirgan asarlaringiz shu yerda ko'rinadi.",
    emptyBasket: "Savatingiz chiroyli asarni kutmoqda.", total: "Taxminiy jami",
    share: "Ulashish", save: "Ko'rinishni saqlash", liveCamera: "Jonli kamera", uploadRoom: "Xona rasmini yuklash",
    back: "Orqaga", filters: "Filtrlar", newest: "Yangi", popular: "Mashhur", priceLow: "Arzonidan boshlab",
  },
} as const;

export type TranslationKey = keyof typeof copy.en;
export const t = (language: Language, key: TranslationKey) => copy[language][key];
