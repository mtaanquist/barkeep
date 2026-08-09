export interface TranslationMap {
  // Landing page
  welcome: string;
  barIsOpen: string;
  landingIntro: string;
  readyCollect: string;
  backToMenu: string;
  setup: string;
  categories: string;
  queue: string;
  copyLink: string;
  noDrinksAvailable: string;
  allDrinks: string;
  filterDrinks: string;
  baseSpirits: string;
  noPastOrders: string;
  addFavourite: string;
  removeFavourite: string;
  reloadPage: string;
  welcomeToBar: string;
  qrArrival: string;
  yourName: string;
  startOrdering: string;
  barNotFound: string;
  goHome: string;
  loadingBar: string;
  bartenderLogin: string;
  guestLogin: string;
  createBar: string;
  barName: string;
  bartenderPassword: string;
  guestPassword: string;
  language: string;
  create: string;
  login: string;
  enterPassword: string;
  enterName: string;

  // Bartender interface
  pendingOrders: string;
  noPendingOrders: string;
  markProcessed: string;
  acceptOrder: string;
  rejectOrder: string;
  markReady: string;
  drinkMenu: string;
  addDrink: string;
  editDrink: string;
  deleteDrink: string;
  toggleStock: string;
  inStock: string;
  outOfStock: string;
  analytics: string;
  popularDrinks: string;
  peakHours: string;
  totalOrders: string;
  ordersToday: string;

  // Drink form
  drinkTitle: string;
  drinkImage: string;
  uploadImage: string;
  or: string;
  recipe: string;
  guestDescription: string;
  showRecipeToGuests: string;
  guestDescriptionHelp: string;
  showRecipeHelp: string;
  save: string;
  cancel: string;
  confirmCancelOrder: string;
  cancelOrder: string;

  // Customer interface
  availableDrinks: string;
  order: string;
  viewRecipe: string;
  yourOrder: string;
  orderStatus: string;
  new: string;
  accepted: string;
  rejected: string;
  ready: string;
  processed: string;
  howToOrder: string;
  howToOrderInstructions: string;
  surpriseMe: string;
  yourRandomDrink: string;
  baseSpirit: string;
  orderThis: string;
  tryAnother: string;
  pastOrders: string; // Added
  favourites: string; // Added
  reorder: string; // Added
  status: string; // Added

  // QR Code
  generateQR: string;
  qrCodeTitle: string;
  qrCodeInstructions: string;
  downloadQR: string;
  directLink: string;
  close: string;

  // Status messages
  oneOrderLimit: string;
  orderPlaced: string;
  loading: string;
  error: string;
  retry: string;
  logout: string;
  settings: string;

  // Shown when the live order updates drop out
  connectionLostTitle: string;
  connectionLostBody: string;
  connectionLostRetry: string;
  connectionLostDismiss: string;
}

export const translations: { en: TranslationMap; da: TranslationMap } = {
  en: {
    // Landing page
    welcome: "Welcome to",
    barIsOpen: "The bar is open.",
    readyCollect: "Ready · collect at the bar",
    backToMenu: "Back to the menu",
    setup: "Setup",
    categories: "Categories",
    queue: "The queue",
    copyLink: "Copy link",
    noDrinksAvailable: "No drinks available right now",
    allDrinks: "All drinks",
    filterDrinks: "Filter drinks",
    baseSpirits: "Base spirits",
    noPastOrders: "No past orders yet",
    addFavourite: "Add to favourites",
    removeFavourite: "Remove from favourites",
    reloadPage: "Reload the page",
    welcomeToBar: "Welcome to the bar",
    qrArrival: "You scanned the code, so you are already in. Type your first name to start ordering.",
    yourName: "Your name",
    startOrdering: "Start ordering",
    barNotFound: "Bar not found",
    goHome: "Go to the front page",
    loadingBar: "Fetching the bar…",
    landingIntro:
      "Pick a bar, type your first name, and order from your phone. No account, no app.",
    bartenderLogin: "Bartender Login",
    guestLogin: "Guest Login",
    createBar: "Create New Bar",
    barName: "Bar Name",
    bartenderPassword: "Bartender Password",
    guestPassword: "Guest Password",
    language: "Language",
    create: "Create",
    login: "Login",
    enterPassword: "Enter Password",
    enterName: "Enter Your Name",

    // Bartender interface
    pendingOrders: "Pending Orders",
    noPendingOrders: "No pending orders",
    markProcessed: "Mark as Processed",
    acceptOrder: "Accept",
    rejectOrder: "Reject",
    markReady: "Mark Ready",
    drinkMenu: "Drink Menu",
    addDrink: "Add Drink",
    editDrink: "Edit Drink",
    deleteDrink: "Delete",
    toggleStock: "Toggle Stock",
    inStock: "In Stock",
    outOfStock: "Out of Stock",
    analytics: "Analytics",
    popularDrinks: "Popular Drinks",
    peakHours: "Peak Hours",
    totalOrders: "Total Orders",
    ordersToday: "Orders Today",

    // Drink form
    drinkTitle: "Drink Title",
    drinkImage: "Image URL",
    uploadImage: "Upload Image",
    or: "or",
    recipe: "Recipe (Markdown)",
    guestDescription: "Guest Description",
    showRecipeToGuests: "Show Recipe to Guests",
    guestDescriptionHelp: "Optional description shown to guests instead of or alongside the recipe",
    showRecipeHelp: "When enabled, guests can see the full recipe. When disabled, they only see the guest description (if provided).",
    save: "Save",
    cancel: "Cancel",
    confirmCancelOrder: "Are you sure you want to cancel your order?",
    cancelOrder: "Cancel Order",

    // Customer interface
    availableDrinks: "Available Drinks",
    order: "Order",
    viewRecipe: "View Recipe",
    yourOrder: "Your Order",
    orderStatus: "Order Status",
    new: "New",
    accepted: "Accepted",
    rejected: "Rejected",
    ready: "Ready",
    processed: "Processed",
    howToOrder: "How to order",
    howToOrderInstructions:
      'Browse the available drinks below and click "Order" to place your order. You can only have one active order at a time. Your order status will update in real-time.',
    surpriseMe: "Surprise Me!",
    yourRandomDrink: "Your Random Drink",
    baseSpirit: "Base Spirit",
    orderThis: "Order this!",
    tryAnother: "Try another",
    pastOrders: "Past Orders", // Added
    favourites: "Favourites", // Added
    reorder: "Reorder", // Added
    status: "Status", // Added

    // QR Code
    generateQR: "Generate QR",
    qrCodeTitle: "QR Code for",
    qrCodeInstructions: "Guests can scan this QR code to quickly access your bar and place orders.",
    downloadQR: "Download QR Code",
    directLink: "Direct link:",
    close: "Close",

    // Status messages
    oneOrderLimit: "You can only have one active order at a time",
    orderPlaced: "Order placed successfully!",
    loading: "Loading...",
    error: "Error",
    retry: "Retry",
    logout: "Logout",
    settings: "Settings",
    connectionLostTitle: "Not updating right now",
    connectionLostBody:
      "You may not see new orders until this comes back. It usually sorts itself out in a moment.",
    connectionLostRetry: "Try again now",
    connectionLostDismiss: "Carry on anyway",
  },
  da: {
    // Landing page (Danish)
    welcome: "Velkommen til",
    barIsOpen: "Baren er åben.",
    readyCollect: "Klar · hent den i baren",
    backToMenu: "Tilbage til menuen",
    setup: "Opsætning",
    categories: "Kategorier",
    queue: "Køen",
    copyLink: "Kopiér link",
    noDrinksAvailable: "Ingen drinks lige nu",
    allDrinks: "Alle drinks",
    filterDrinks: "Filtrér drinks",
    baseSpirits: "Basisspiritus",
    noPastOrders: "Ingen tidligere bestillinger endnu",
    addFavourite: "Tilføj til favoritter",
    removeFavourite: "Fjern fra favoritter",
    reloadPage: "Genindlæs siden",
    welcomeToBar: "Velkommen i baren",
    qrArrival: "Du har scannet koden, så du er inde. Skriv dit fornavn for at komme i gang.",
    yourName: "Dit navn",
    startOrdering: "Kom i gang",
    barNotFound: "Baren blev ikke fundet",
    goHome: "Gå til forsiden",
    loadingBar: "Henter baren…",
    landingIntro:
      "Vælg en bar, skriv dit fornavn, og bestil fra telefonen. Ingen konto, ingen app.",
    bartenderLogin: "Bartender Login",
    guestLogin: "Gæst Login",
    createBar: "Opret Ny Bar",
    barName: "Bar Navn",
    bartenderPassword: "Bartender Adgangskode",
    guestPassword: "Gæst Adgangskode",
    language: "Sprog",
    create: "Opret",
    login: "Log ind",
    enterPassword: "Indtast Adgangskode",
    enterName: "Indtast Dit Navn",

    // Bartender interface
    pendingOrders: "Afventende Bestillinger",
    noPendingOrders: "Ingen afventende bestillinger",
    markProcessed: "Markér som Behandlet",
    acceptOrder: "Acceptér",
    rejectOrder: "Afvis",
    markReady: "Markér Klar",
    drinkMenu: "Drinks",
    addDrink: "Tilføj Drink",
    editDrink: "Rediger Drink",
    deleteDrink: "Slet",
    toggleStock: "Skift Lager",
    inStock: "På Lager",
    outOfStock: "Ikke på Lager",
    analytics: "Analyser",
    popularDrinks: "Populære Drinks",
    peakHours: "Travle Timer",
    totalOrders: "Samlede Bestillinger",
    ordersToday: "Bestillinger I Dag",

    // Drink form
    drinkTitle: "Drink Titel",
    drinkImage: "Billede URL",
    uploadImage: "Upload Billede",
    or: "eller",
    recipe: "Opskrift (Markdown)",
    guestDescription: "Gæste Beskrivelse",
    showRecipeToGuests: "Vis Opskrift til Gæster",
    guestDescriptionHelp: "Valgfri beskrivelse vist til gæster i stedet for eller sammen med opskriften",
    showRecipeHelp: "Når aktiveret, kan gæster se den fulde opskrift. Når deaktiveret, ser de kun gæste beskrivelsen (hvis angivet).",
    save: "Gem",
    cancel: "Annuller",
    confirmCancelOrder: "Er du sikker på, at du vil annullere din bestilling?",
    cancelOrder: "Annuller bestilling",

    // Customer interface
    availableDrinks: "Tilgængelige Drinks",
    order: "Bestil",
    viewRecipe: "Se Opskrift",
    yourOrder: "Din Bestilling",
    orderStatus: "Bestillingsstatus",
    new: "Ny",
    accepted: "Accepteret",
    rejected: "Afvist",
    ready: "Klar",
    processed: "Behandlet",
    howToOrder: "How to order",
    howToOrderInstructions:
      'Browse the available drinks below and click "Order" to place your order. You can only have one active order at a time. Your order status will update in real-time.',
    surpriseMe: "Surprise Me!",
    yourRandomDrink: "Your Random Drink",
    baseSpirit: "Base Spirit",
    orderThis: "Bestil denne!",
    tryAnother: "Prøv en anden",
    pastOrders: "Tidligere bestillinger", // Added
    favourites: "Favoritter", // Added
    reorder: "Bestil igen", // Added
    status: "Status", // Added

    // QR Code
    generateQR: "Generér QR",
    qrCodeTitle: "QR-kode til",
    qrCodeInstructions: "Gæster kan scanne denne QR-kode for hurtigt at få adgang til din bar og afgive bestillinger.",
    downloadQR: "Download QR-kode",
    directLink: "Direkte link:",
    close: "Luk",

    // Status messages
    oneOrderLimit: "Du kan kun have én aktiv bestilling ad gangen",
    orderPlaced: "Bestilling afgivet!",
    loading: "Indlæser...",
    error: "Fejl",
    retry: "Prøv igen",
    logout: "Log ud",
    settings: "Indstillinger",
    connectionLostTitle: "Opdaterer ikke lige nu",
    connectionLostBody:
      "Du ser måske ikke nye bestillinger, før forbindelsen er tilbage. Det plejer at løse sig af sig selv.",
    connectionLostRetry: "Prøv igen nu",
    connectionLostDismiss: "Fortsæt alligevel",
  },
};

export type TranslationKeys = keyof typeof translations.en;

export function useTranslation(language: keyof typeof translations) {
  return (key: TranslationKeys) => translations[language][key] || key;
}
