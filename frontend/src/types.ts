// What the pages get back from the API. The shapes live in shared/types.d.ts
// next to the server, so changing one side without the other is a build error.
//
// A few things are re-named here to match how the pages talk about them.

export type {
  Bar,
  BarQrCode,
  Category,
  Flag,
  Language,
  LiveUpdate,
  OperatorBar,
  OrderStatus,
  Regular,
  SignedIn,
  UserType,
} from "@shared/types";

export type {
  // The pages always list drinks with their category filled in, and with the
  // favourite marked when the bar knows who is asking.
  DrinkForGuest as Drink,
  // What the read-only view needs, which an order can stand up on its own.
  DrinkToRead,
  // Orders carry the recipe too, which only the bartender's pages show.
  OrderForBartender as Order,
  OrderAnalytics as Analytics,
} from "@shared/types";
