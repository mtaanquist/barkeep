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
  filterShort: string;
  baseSpirits: string;
  noPastOrders: string;
  addFavourite: string;
  removeFavourite: string;
  reloadPage: string;
  welcomeToBar: string;
  qrArrival: string;
  yourName: string;
  startOrdering: string;
  greeting: string;
  letTheBarChoose: string;
  confirmReject: string;
  bartender: string;
  loadingAnalytics: string;
  gatheringData: string;
  statusDistribution: string;
  recentActivity: string;
  selectBar: string;
  refreshBars: string;
  addCategory: string;
  categoryName: string;
  categoriesHelp: string;
  noCategories: string;
  noCategoriesHelp: string;
  deleteCategory: string;
  editCategory: string;
  noCategory: string;
  selectBaseSpirit: string;
  guestDescriptionPlaceholder: string;
  cropImage: string;
  apply: string;
  reset: string;
  loadingEditor: string;
  edit: string;
  view: string;
  noDrinks: string;
  noDrinksHelp: string;
  totalDrinks: string;
  sortDefault: string;
  sortAlphabetical: string;
  sortCategory: string;
  showRecipes: string;
  hideRecipes: string;
  ordersArriveHere: string;
  recentlyCompleted: string;
  activeCount: string;
  completedToday: string;
  barSettings: string;
  barInformation: string;
  autoAccept: string;
  autoAcceptHelp: string;
  sectionTheBar: string;
  barNameHelp: string;
  ordersClosedLabel: string;
  ordersClosedHelp: string;
  barClosed: string;
  barClosedHelp: string;
  lastOrdersTime: string;
  lastOrdersTimeHelp: string;
  lastOrdersTonight: string;
  lastOrdersTomorrow: string;
  clearLastOrders: string;
  maxActiveOrders: string;
  maxActiveOrdersHelp: string;
  sectionAccess: string;
  guestCode: string;
  guestCodeHelp: string;
  bartenderCode: string;
  changeCode: string;
  codeUnchanged: string;
  guestLink: string;
  rotateGuestLink: string;
  rotateGuestLinkHelp: string;
  confirmRotateGuestLink: string;
  guestLinkRotated: string;
  reportingWindow: string;
  lastSevenDays: string;
  lastThirtyDays: string;
  lastNinetyDays: string;
  saveSettings: string;
  savingSettings: string;
  settingsSaved: string;
  englishName: string;
  danishName: string;
  imageHelp: string;
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
  rememberMe: string;
  rememberMeHelp: string;

  // Claiming a name (regulars)
  setPassword: string;
  setPasswordHelp: string;
  setAPassword: string;
  yourPassword: string;
  nameClaimedHelp: string;
  wrongPassword: string;
  changePassword: string;
  currentPassword: string;
  newPassword: string;
  passwordChanged: string;

  // Regulars (bartender)
  regulars: string;
  regularsIntro: string;
  noRegulars: string;
  regularSince: string;
  rename: string;
  nameTaken: string;
  guestRenamed: string;
  setGuestPassword: string;
  setGuestPasswordHelp: string;
  guestPasswordSet: string;

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

  // The drink list
  newDrink: string;
  inTotal: string;
  columnName: string;
  columnCategory: string;
  columnStock: string;
  noPhoto: string;
  confirmDeleteDrink: string;

  // Drink form
  sectionGuestSees: string;
  sectionRecipe: string;
  sectionPlacement: string;
  optionalSection: string;
  oneRequiredSection: string;
  drinkName: string;
  drinkNamePlaceholder: string;
  guestDescriptionPrompt: string;
  saveDrink: string;
  deleteThisDrink: string;
  inStockHelp: string;
  chooseImage: string;
  imageFormats: string;
  cropAgain: string;
  removeImage: string;
  orPasteLink: string;
  uploading: string;
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
  barChoseForYou: string;
  baseSpirit: string;
  servings: string;
  orderThis: string;
  tryAnother: string;
  pastOrders: string; // Added
  menuLabel: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  tonight: string;
  orderAgain: string;
  reorderWhenCollected: string;
  youAreHereAs: string;
  notMe: string;
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

  // Operator panel
  operatorTitle: string;
  operatorIntro: string;
  operatorPasswordPlaceholder: string;
  operatorSignIn: string;
  operatorWrongPassword: string;
  operatorSignOut: string;
  operatorBars: string;
  operatorCreated: string;
  operatorLastUsed: string;
  operatorNeverUsed: string;
  operatorDrinks: string;
  operatorOrders: string;
  operatorRemove: string;
  operatorRestore: string;
  operatorRetiredTag: string;
  operatorRemovedOnPrefix: string;
  operatorConfirmTitle: string;
  operatorConfirmBody: string;
  operatorConfirmButton: string;
  operatorNoBars: string;
  operatorLoadError: string;
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
    filterShort: "Filter",
    baseSpirits: "Base spirits",
    noPastOrders: "No past orders yet",
    addFavourite: "Add to favourites",
    removeFavourite: "Remove from favourites",
    reloadPage: "Reload the page",
    welcomeToBar: "Welcome to the bar",
    qrArrival: "You scanned the code, so you are already in. Type your first name to start ordering.",
    yourName: "Your name",
    startOrdering: "Start ordering",
    greeting: "Welcome",
    letTheBarChoose: "Let the bar choose",
    confirmReject: "Reject this order? The guest is told straight away.",
    bartender: "Bartender",
    loadingAnalytics: "Fetching the reports…",
    gatheringData: "Gathering the numbers from your orders",
    statusDistribution: "Where the orders are",
    recentActivity: "Lately",
    selectBar: "Choose a bar",
    refreshBars: "Refresh the list",
    addCategory: "Add category",
    categoryName: "Category name",
    categoriesHelp: "Group the drinks so guests can find them.",
    noCategories: "No categories yet",
    noCategoriesHelp: "Add one to start grouping the drinks.",
    deleteCategory: "Delete category",
    editCategory: "Rename category",
    noCategory: "No category",
    selectBaseSpirit: "Choose a base spirit",
    guestDescriptionPlaceholder: "Shown to guests. Optional.",
    cropImage: "Crop and position",
    apply: "Apply",
    reset: "Reset",
    loadingEditor: "Fetching the editor…",
    edit: "Edit",
    view: "View",
    noDrinks: "No drinks yet",
    noDrinksHelp: "Add the first one to start the menu.",
    totalDrinks: "Drinks in total",
    sortDefault: "Sort: as added",
    sortAlphabetical: "Sort: A to Z",
    sortCategory: "Sort: by category",
    showRecipes: "Show recipes",
    hideRecipes: "Hide recipes",
    ordersArriveHere: "New orders turn up here on their own.",
    recentlyCompleted: "Just served",
    activeCount: "active",
    completedToday: "Served today",
    barSettings: "Bar settings",
    barInformation: "About this bar",
    autoAccept: "Take orders automatically",
    autoAcceptHelp:
      "Orders go straight to the queue as accepted, so nobody has to tap twice on a busy night.",
    sectionTheBar: "the bar",
    barNameHelp: "Shown at the top of the guest menu and on the QR page.",
    ordersClosedLabel: "Stop taking orders",
    ordersClosedHelp:
      "Last orders. The queue keeps working, so anything already ordered still gets made.",
    barClosed: "The bar has stopped taking orders",
    barClosedHelp: "Anything you already ordered is still coming.",
    lastOrdersTime: "Last orders at",
    lastOrdersTimeHelp:
      "The bar stops on its own at this time. Signing in again opens it up.",
    lastOrdersTonight: "tonight",
    lastOrdersTomorrow: "tomorrow morning",
    clearLastOrders: "No set time",
    maxActiveOrders: "Drinks at a time, per guest",
    maxActiveOrdersHelp:
      "Guests give their own name, so treat this as a courtesy rather than a lock.",
    sectionAccess: "access",
    guestCode: "Guest code",
    guestCodeHelp: "Shared with guests along with the QR code.",
    bartenderCode: "Bartender code",
    changeCode: "Change",
    codeUnchanged: "Leave blank to keep the one you have.",
    guestLink: "Guest link",
    rotateGuestLink: "Make a new link",
    rotateGuestLinkHelp:
      "The QR code stays valid until you do this. After it, print a new one.",
    confirmRotateGuestLink:
      "Make a new link? Every QR code already printed stops working.",
    guestLinkRotated: "New link made. Print a new QR code.",
    reportingWindow: "Showing",
    lastSevenDays: "the last 7 days",
    lastThirtyDays: "the last 30 days",
    lastNinetyDays: "the last 90 days",
    saveSettings: "Save settings",
    savingSettings: "Saving…",
    settingsSaved: "Saved.",
    englishName: "English",
    danishName: "Danish",
    imageHelp: "PNG or JPG, up to 5 MB.",
    barNotFound: "Bar not found",
    goHome: "Go to the front page",
    loadingBar: "Fetching the bar…",
    landingIntro:
      "Pick a bar, type your first name, and order from your phone. No account needed — or claim your name so it stays yours.",
    bartenderLogin: "Bartender Login",
    guestLogin: "Guest Login",
    createBar: "Create New Bar",
    barName: "Bar name",
    bartenderPassword: "Bartender Password",
    guestPassword: "Guest Password",
    language: "Language",
    create: "Create",
    login: "Login",
    enterPassword: "Enter Password",
    enterName: "Enter Your Name",
    rememberMe: "Remember me on this phone",
    rememberMeHelp: "So you do not have to type your name again next time.",

    // Claiming a name (regulars)
    setPassword: "Make this name mine",
    setPasswordHelp:
      "Set a password so only you can use this name at this bar.",
    setAPassword: "Choose a password",
    yourPassword: "Your password",
    nameClaimedHelp:
      "This name is taken here. Enter its password — or add a last name or initial if it is not you.",
    wrongPassword: "That password is not right.",
    changePassword: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    passwordChanged: "Password changed.",

    // Regulars (bartender)
    regulars: "Regulars",
    regularsIntro:
      "Guests who have claimed their name here. Rename one to fix a name or tell two apart — let them know their new name next time.",
    noRegulars: "No regulars yet.",
    regularSince: "Regular since",
    rename: "Rename",
    nameTaken: "That name is already taken.",
    guestRenamed: "Renamed.",
    setGuestPassword: "Set password",
    setGuestPasswordHelp:
      "Hand them the tablet to type a new one, or set a simple one they can change later.",
    guestPasswordSet: "Password set.",

    // Bartender interface
    pendingOrders: "Pending Orders",
    noPendingOrders: "No pending orders",
    markProcessed: "Mark as Processed",
    acceptOrder: "Accept",
    rejectOrder: "Reject",
    markReady: "Mark Ready",
    drinkMenu: "Drinks",
    addDrink: "Add drink",
    editDrink: "Edit drink",
    deleteDrink: "Delete",
    toggleStock: "Toggle Stock",
    inStock: "In stock",
    outOfStock: "Out of stock",
    analytics: "Analytics",
    popularDrinks: "Popular Drinks",
    peakHours: "Peak Hours",
    totalOrders: "Total Orders",
    ordersToday: "Orders Today",

    // The drink list
    newDrink: "New drink",
    inTotal: "in total",
    columnName: "name",
    columnCategory: "category",
    columnStock: "stock",
    noPhoto: "no photo",
    confirmDeleteDrink: "Delete this drink? It will go from the menu for good.",

    // Drink form
    sectionGuestSees: "what the guest sees",
    sectionRecipe: "recipe",
    sectionPlacement: "where it lives",
    optionalSection: "optional",
    oneRequiredSection: "1 needed",
    drinkName: "Name",
    drinkNamePlaceholder: "e.g. Negroni Sbagliato",
    guestDescriptionPrompt: "What is in it, and how does it taste?",
    saveDrink: "Save drink",
    deleteThisDrink: "Delete this drink",
    inStockHelp: "Turn this off and the drink still shows, but cannot be ordered.",
    chooseImage: "Choose a picture",
    imageFormats: "JPG or PNG · cropped 3:2",
    cropAgain: "Crop again",
    removeImage: "Remove",
    orPasteLink: "or paste a link to one",
    uploading: "Sending the picture",
    drinkTitle: "Drink Title",
    drinkImage: "Photo",
    uploadImage: "Upload Image",
    or: "or",
    recipe: "Recipe (Markdown)",
    guestDescription: "Description for the guest",
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
    processed: "Picked up",
    howToOrder: "How to order",
    howToOrderInstructions:
      'Browse the available drinks below and click "Order" to place your order. You can only have one active order at a time. Your order status will update in real-time.',
    surpriseMe: "Surprise me",
    yourRandomDrink: "Your Random Drink",
    barChoseForYou: "the bar chose for you",
    baseSpirit: "Base spirit",
    servings: "serves",
    orderThis: "Order this!",
    tryAnother: "Try another",
    pastOrders: "Past orders", // Added
    menuLabel: "Menu",
    themeSystem: "Theme: follow my phone",
    themeLight: "Theme: light",
    themeDark: "Theme: dark",
    tonight: "tonight",
    orderAgain: "Again",
    reorderWhenCollected:
      "You can order again once your current drink has been picked up.",
    youAreHereAs: "You are here as",
    notMe: "That is not me",
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
    operatorTitle: "Operator",
    operatorIntro: "Every bar on this server.",
    operatorPasswordPlaceholder: "Operator password",
    operatorSignIn: "Sign in",
    operatorWrongPassword: "That password did not work.",
    operatorSignOut: "Sign out",
    operatorBars: "Bars",
    operatorCreated: "Created",
    operatorLastUsed: "Last used",
    operatorNeverUsed: "Never used",
    operatorDrinks: "drinks",
    operatorOrders: "orders",
    operatorRemove: "Remove",
    operatorRestore: "Restore",
    operatorRetiredTag: "Removed",
    operatorRemovedOnPrefix: "Removed on",
    operatorConfirmTitle: "Remove this bar?",
    operatorConfirmBody:
      "It disappears for guests and bartenders straight away, but can be restored until it is removed for good. Type the bar's name to confirm.",
    operatorConfirmButton: "Remove bar",
    operatorNoBars: "No bars on this server yet.",
    operatorLoadError: "Could not load the bars.",
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
    filterShort: "Filtrér",
    baseSpirits: "Basisspiritus",
    noPastOrders: "Ingen tidligere bestillinger endnu",
    addFavourite: "Tilføj til favoritter",
    removeFavourite: "Fjern fra favoritter",
    reloadPage: "Genindlæs siden",
    welcomeToBar: "Velkommen i baren",
    qrArrival: "Du har scannet koden, så du er inde. Skriv dit fornavn for at komme i gang.",
    yourName: "Dit navn",
    startOrdering: "Kom i gang",
    greeting: "Velkommen",
    letTheBarChoose: "Lad baren vælge",
    confirmReject: "Afvis denne bestilling? Gæsten får besked med det samme.",
    bartender: "Bartender",
    loadingAnalytics: "Henter rapporterne…",
    gatheringData: "Samler tal fra bestillingerne",
    statusDistribution: "Hvor bestillingerne er",
    recentActivity: "På det seneste",
    selectBar: "Vælg en bar",
    refreshBars: "Opdatér listen",
    addCategory: "Tilføj kategori",
    categoryName: "Kategorinavn",
    categoriesHelp: "Gruppér dine drinks, så gæsterne kan finde dem.",
    noCategories: "Ingen kategorier endnu",
    noCategoriesHelp: "Tilføj en for at begynde at gruppere dine drinks.",
    deleteCategory: "Slet kategori",
    editCategory: "Omdøb kategori",
    noCategory: "Ingen kategori",
    selectBaseSpirit: "Vælg basisspiritus",
    guestDescriptionPlaceholder: "Vises for gæsterne. Valgfrit.",
    cropImage: "Beskær og placér",
    apply: "Brug",
    reset: "Nulstil",
    loadingEditor: "Henter editoren…",
    edit: "Redigér",
    view: "Se",
    noDrinks: "Ingen drinks endnu",
    noDrinksHelp: "Tilføj den første for at starte menuen.",
    totalDrinks: "Drinks i alt",
    sortDefault: "Sortér: som tilføjet",
    sortAlphabetical: "Sortér: A til Å",
    sortCategory: "Sortér: efter kategori",
    showRecipes: "Vis opskrifter",
    hideRecipes: "Skjul opskrifter",
    ordersArriveHere: "Nye bestillinger dukker op her af sig selv.",
    recentlyCompleted: "Netop serveret",
    activeCount: "aktive",
    completedToday: "Serveret i dag",
    barSettings: "Barens indstillinger",
    barInformation: "Om baren",
    autoAccept: "Tag imod bestillinger automatisk",
    autoAcceptHelp:
      "Bestillinger går direkte i køen som accepteret, så ingen skal trykke to gange på en travl aften.",
    sectionTheBar: "baren",
    barNameHelp: "Vises øverst på gæsternes menu og på QR-siden.",
    ordersClosedLabel: "Stop med at tage imod bestillinger",
    ordersClosedHelp:
      "Sidste udkald. Køen virker stadig, så det der allerede er bestilt bliver lavet.",
    barClosed: "Baren tager ikke imod flere bestillinger",
    barClosedHelp: "Det du allerede har bestilt er stadig på vej.",
    lastOrdersTime: "Sidste udkald kl.",
    lastOrdersTimeHelp:
      "Baren lukker af sig selv på det tidspunkt. Den åbner igen, når du logger ind.",
    lastOrdersTonight: "i aften",
    lastOrdersTomorrow: "i morgen tidlig",
    clearLastOrders: "Intet fast tidspunkt",
    maxActiveOrders: "Drinks ad gangen, per gæst",
    maxActiveOrdersHelp:
      "Gæsterne skriver selv deres navn, så det er en høflighed mere end en lås.",
    sectionAccess: "adgang",
    guestCode: "Gæstekode",
    guestCodeHelp: "Deles med gæsterne sammen med QR-koden.",
    bartenderCode: "Bartenderkode",
    changeCode: "Skift",
    codeUnchanged: "Lad feltet stå tomt for at beholde den, du har.",
    guestLink: "Gæstelink",
    rotateGuestLink: "Lav et nyt link",
    rotateGuestLinkHelp:
      "QR-koden virker, indtil du gør det her. Bagefter skal du printe en ny.",
    confirmRotateGuestLink:
      "Lav et nyt link? Alle QR-koder, der allerede er printet, holder op med at virke.",
    guestLinkRotated: "Nyt link lavet. Print en ny QR-kode.",
    reportingWindow: "Viser",
    lastSevenDays: "de sidste 7 dage",
    lastThirtyDays: "de sidste 30 dage",
    lastNinetyDays: "de sidste 90 dage",
    saveSettings: "Gem indstillinger",
    savingSettings: "Gemmer…",
    settingsSaved: "Gemt.",
    englishName: "Engelsk",
    danishName: "Dansk",
    imageHelp: "PNG eller JPG, op til 5 MB.",
    barNotFound: "Baren blev ikke fundet",
    goHome: "Gå til forsiden",
    loadingBar: "Henter baren…",
    landingIntro:
      "Vælg en bar, skriv dit fornavn, og bestil fra telefonen. Ingen konto nødvendig — eller gør navnet til dit, så det bliver ved med at være dit.",
    bartenderLogin: "Bartender login",
    guestLogin: "Gæst login",
    createBar: "Opret ny bar",
    barName: "Bar navn",
    bartenderPassword: "Bartender adgangskode",
    guestPassword: "Gæst adgangskode",
    language: "Sprog",
    create: "Opret",
    login: "Log ind",
    enterPassword: "Indtast adgangskode",
    enterName: "Indtast dit navn",
    rememberMe: "Husk mig på denne telefon",
    rememberMeHelp: "Så du ikke skal skrive dit navn igen næste gang.",

    // Claiming a name (regulars)
    setPassword: "Gør dette navn til mit",
    setPasswordHelp:
      "Vælg en adgangskode, så kun du kan bruge dette navn i denne bar.",
    setAPassword: "Vælg en adgangskode",
    yourPassword: "Din adgangskode",
    nameClaimedHelp:
      "Dette navn er taget her. Indtast dets adgangskode — eller tilføj et efternavn eller et forbogstav, hvis det ikke er dig.",
    wrongPassword: "Den adgangskode passer ikke.",
    changePassword: "Skift adgangskode",
    currentPassword: "Nuværende adgangskode",
    newPassword: "Ny adgangskode",
    passwordChanged: "Adgangskoden er skiftet.",

    // Regulars (bartender)
    regulars: "Faste gæster",
    regularsIntro:
      "Gæster der har gjort deres navn til deres her. Omdøb en for at rette et navn eller skelne to fra hinanden — fortæl dem deres nye navn næste gang.",
    noRegulars: "Ingen faste gæster endnu.",
    regularSince: "Fast gæst siden",
    rename: "Omdøb",
    nameTaken: "Det navn er allerede taget.",
    guestRenamed: "Omdøbt.",
    setGuestPassword: "Vælg adgangskode",
    setGuestPasswordHelp:
      "Ræk dem tabletten, så de selv kan skrive en ny, eller vælg en simpel en, de kan ændre senere.",
    guestPasswordSet: "Adgangskoden er sat.",

    // Bartender interface
    pendingOrders: "Afventende bestillinger",
    noPendingOrders: "Ingen afventende bestillinger",
    markProcessed: "Markér som behandlet",
    acceptOrder: "Acceptér",
    rejectOrder: "Afvis",
    markReady: "Markér klar",
    drinkMenu: "Drinks",
    addDrink: "Tilføj drink",
    editDrink: "Rediger drink",
    deleteDrink: "Slet",
    toggleStock: "Skift lager",
    inStock: "På lager",
    outOfStock: "Udsolgt",
    analytics: "Analyser",
    popularDrinks: "Populære drinks",
    peakHours: "Travle timer",
    totalOrders: "Samlede bestillinger",
    ordersToday: "Bestillinger i dag",

    // The drink list
    newDrink: "Ny drink",
    inTotal: "i alt",
    columnName: "navn",
    columnCategory: "kategori",
    columnStock: "lager",
    noPhoto: "intet foto",
    confirmDeleteDrink: "Slet denne drink? Den forsvinder fra menuen for altid.",

    // Drink form
    sectionGuestSees: "det gæsten ser",
    sectionRecipe: "opskrift",
    sectionPlacement: "hvor den hører til",
    optionalSection: "valgfri",
    oneRequiredSection: "1 påkrævet",
    drinkName: "Navn",
    drinkNamePlaceholder: "F.eks. Negroni Sbagliato",
    guestDescriptionPrompt: "Hvad er der i, og hvordan smager den?",
    saveDrink: "Gem drink",
    deleteThisDrink: "Slet denne drink",
    inStockHelp: "Slå fra, og drinken vises stadig, men kan ikke bestilles.",
    chooseImage: "Vælg et billede",
    imageFormats: "JPG eller PNG · beskæres 3:2",
    cropAgain: "Beskær igen",
    removeImage: "Fjern",
    orPasteLink: "eller indsæt et link til et",
    uploading: "Sender billedet",
    drinkTitle: "Drink titel",
    drinkImage: "Foto",
    uploadImage: "Upload billede",
    or: "eller",
    recipe: "Opskrift (Markdown)",
    guestDescription: "Beskrivelse til gæsten",
    showRecipeToGuests: "Vis opskrift til gæster",
    guestDescriptionHelp: "Valgfri beskrivelse vist til gæster i stedet for eller sammen med opskriften",
    showRecipeHelp: "Når aktiveret, kan gæster se den fulde opskrift. Når deaktiveret, ser de kun gæste beskrivelsen (hvis angivet).",
    save: "Gem",
    cancel: "Annuller",
    confirmCancelOrder: "Er du sikker på, at du vil annullere din bestilling?",
    cancelOrder: "Annuller bestilling",

    // Customer interface
    availableDrinks: "Tilgængelige drinks",
    order: "Bestil",
    viewRecipe: "Se opskrift",
    yourOrder: "Din bestilling",
    orderStatus: "Bestillingsstatus",
    new: "Ny",
    accepted: "Accepteret",
    rejected: "Afvist",
    ready: "Klar",
    processed: "Afhentet",
    howToOrder: "How to order",
    howToOrderInstructions:
      'Browse the available drinks below and click "Order" to place your order. You can only have one active order at a time. Your order status will update in real-time.',
    surpriseMe: "Overrask mig",
    yourRandomDrink: "Din tilfældige drink",
    barChoseForYou: "baren har valgt til dig",
    baseSpirit: "Basisspiritus",
    servings: "til",
    orderThis: "Bestil denne!",
    tryAnother: "Prøv en anden",
    pastOrders: "Tidligere bestillinger", // Added
    menuLabel: "Menu",
    themeSystem: "Udseende: følg min telefon",
    themeLight: "Udseende: lyst",
    themeDark: "Udseende: mørkt",
    tonight: "i aften",
    orderAgain: "Igen",
    reorderWhenCollected:
      "Du kan bestille igen, når din nuværende drink er hentet.",
    youAreHereAs: "Du er her som",
    notMe: "Det er ikke mig",
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
    operatorTitle: "Operatør",
    operatorIntro: "Alle barer på denne server.",
    operatorPasswordPlaceholder: "Operatøradgangskode",
    operatorSignIn: "Log ind",
    operatorWrongPassword: "Den adgangskode virkede ikke.",
    operatorSignOut: "Log ud",
    operatorBars: "Barer",
    operatorCreated: "Oprettet",
    operatorLastUsed: "Sidst brugt",
    operatorNeverUsed: "Aldrig brugt",
    operatorDrinks: "drinks",
    operatorOrders: "bestillinger",
    operatorRemove: "Fjern",
    operatorRestore: "Gendan",
    operatorRetiredTag: "Fjernet",
    operatorRemovedOnPrefix: "Fjernet den",
    operatorConfirmTitle: "Fjern denne bar?",
    operatorConfirmBody:
      "Den forsvinder for gæster og bartendere med det samme, men kan gendannes indtil den slettes endeligt. Skriv barens navn for at bekræfte.",
    operatorConfirmButton: "Fjern bar",
    operatorNoBars: "Ingen barer på denne server endnu.",
    operatorLoadError: "Kunne ikke hente barerne.",
  },
};

export type TranslationKeys = keyof typeof translations.en;

export function useTranslation(language: keyof typeof translations) {
  return (key: TranslationKeys) => translations[language][key] || key;
}
