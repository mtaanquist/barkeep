import { describe, it, expect } from "vitest";

import { ingredientsIn } from "../src/recipes/ingredients.js";

/** Just the names, for the cases where the amount is not the point. */
const namesIn = (recipe: string): string[] =>
  ingredientsIn(recipe).map((i) => i.name);

describe("reading ingredients out of a recipe", () => {
  it("reads the house style, in Danish", () => {
    expect(
      ingredientsIn(`## Ingredienser
- 3 cl Campari
- 3 cl rød vermouth
- 6 cl prosecco

## Fremgangsmåde
1. Fyld glasset med is.`)
    ).toEqual([
      { name: "Campari", amount: "3 cl" },
      { name: "rød vermouth", amount: "3 cl" },
      { name: "prosecco", amount: "6 cl" },
    ]);
  });

  it("reads the same thing in English", () => {
    expect(namesIn("## Ingredients\n- 3 cl gin\n- 2 cl lime")).toEqual([
      "gin",
      "lime",
    ]);
  });

  it("takes a list written with any of the usual marks", () => {
    expect(namesIn("## Ingredients\n* gin\n+ lime\n1. sugar\n2) ice")).toEqual([
      "gin",
      "lime",
      "sugar",
      "ice",
    ]);
  });

  it("stops at the next heading", () => {
    expect(
      namesIn(`## Ingredienser
- gin

## Fremgangsmåde
- Rør det hele sammen`)
    ).toEqual(["gin"]);
  });

  // Without a heading there is no telling a list of ingredients from a list of
  // steps, and a wrong ingredient takes a drink off the menu.
  it("says nothing at all when there is no ingredients heading", () => {
    expect(ingredientsIn("Gin, campari og vermouth.\n\n- Rør med is")).toEqual(
      []
    );
    expect(ingredientsIn(null)).toEqual([]);
    expect(ingredientsIn("")).toEqual([]);
  });

  it("leaves the amount empty when the recipe does not say one", () => {
    expect(ingredientsIn("## Ingredienser\n- Danskvand")).toEqual([
      { name: "Danskvand", amount: null },
    ]);
  });

  it("takes a Danish counting word as the amount", () => {
    expect(ingredientsIn("## Ingredienser\n- 3 skiver agurk")).toEqual([
      { name: "agurk", amount: "3 skiver" },
    ]);
  });

  it("understands decimals, fractions and ranges", () => {
    expect(
      ingredientsIn(`## Ingredients
- 1,5 dl fløde
- ½ citron
- 2-3 dashes Angostura`)
    ).toEqual([
      { name: "fløde", amount: "1,5 dl" },
      { name: "citron", amount: "½" },
      { name: "Angostura", amount: "2-3 dashes" },
    ]);
  });

  // A number is not always an amount.
  it("keeps a name that begins with a number", () => {
    expect(ingredientsIn("## Ingredients\n- 7 Up")).toEqual([
      { name: "7 Up", amount: null },
    ]);
  });

  it("skips a line that reads as prose rather than an ingredient", () => {
    expect(
      namesIn(`## Ingredienser
- 3 cl gin
- Pynt med en appelsinskive. Server straks i et koldt glas.
- Is`)
    ).toEqual(["gin", "Is"]);
  });

  it("takes the Markdown decoration off", () => {
    expect(
      namesIn("## Ingredients\n- **3 cl** _gin_\n- [Campari](http://x.test)")
    ).toEqual(["gin", "Campari"]);
  });

  it("counts the same thing twice as one thing", () => {
    expect(namesIn("## Ingredienser\n- 3 cl gin\n- 2 cl Gin")).toEqual(["gin"]);
  });

  it("takes the notes off a name", () => {
    expect(
      namesIn(`## Ingredients
- 2 ounces bourbon (or rye whiskey, if preferred)
- 1 ounce lime juice, freshly squeezed
- 1 2/3 oz Dark Rum (Havana Club Especial – jeg brugte Bacardi 8)
- 3-4 dashes bitters – gerne orange bitters
- Garnish: orange twist
- Luxardo cherries for garnish
- 1 egg white (optional)`)
    ).toEqual([
      "bourbon",
      "lime juice",
      "Dark Rum",
      "bitters",
      "orange twist",
      "Luxardo cherries",
      "egg white",
    ]);
  });

  // The amount is not always followed by a unit, and the word after it is
  // not always a unit.
  it("only takes a known word as the unit", () => {
    expect(
      ingredientsIn(`## Ingredients
- 20 blueberries (depending on size)
- 4 thyme sprigs
- 1 egg white
- 2 Dashes of Orange Bitters
- 1 heaped barspoon strawberry jam`)
    ).toEqual([
      { name: "blueberries", amount: "20" },
      { name: "thyme sprigs", amount: "4" },
      { name: "egg white", amount: "1" },
      { name: "Orange Bitters", amount: "2 Dashes" },
      { name: "strawberry jam", amount: "1 heaped barspoon" },
    ]);
  });

  it("reads the amounts a bar actually writes", () => {
    expect(
      ingredientsIn(`## Ingredients
- 1½ oz white rum
- 1 ½ oz gin
- 3/4 oz. lime juice
- 1 2/3 oz advocaat
- 1⁄2 oz Aperol
- .25 oz simple syrup
- 60ml Botanist gin
- 5-8 oz lemonade`)
    ).toEqual([
      { name: "white rum", amount: "1½ oz" },
      { name: "gin", amount: "1 ½ oz" },
      { name: "lime juice", amount: "3/4 oz" },
      { name: "advocaat", amount: "1 2/3 oz" },
      { name: "Aperol", amount: "1⁄2 oz" },
      { name: "simple syrup", amount: ".25 oz" },
      { name: "Botanist gin", amount: "60 ml" },
      { name: "lemonade", amount: "5-8 oz" },
    ]);
  });

  it("drops the same amount written again in another unit", () => {
    expect(
      ingredientsIn(`## Ingredients
- ¾ oz/22.5 ml lime juice
- 2 oz. (60 ml) The Botanist Islay Dry Gin
- 2 oz 60mL Reposado Tequila
- 60ml / 2oz Botanist Gin
- ¾ oz/22.5 Amaretto
- 2 oz. -or- 60 ml. Cachaça`)
    ).toEqual([
      { name: "lime juice", amount: "¾ oz" },
      { name: "The Botanist Islay Dry Gin", amount: "2 oz" },
      { name: "Reposado Tequila", amount: "2 oz" },
      { name: "Botanist Gin", amount: "60 ml" },
      { name: "Amaretto", amount: "¾ oz" },
      { name: "Cachaça", amount: "2 oz" },
    ]);
  });

  it("does not mistake an abbreviation for the end of a sentence", () => {
    expect(
      namesIn(`## Ingredients
- 1/2 oz St. Germain
- 1 oz. Simple Syrup
- 1 oz Mr. Black Cold Brew Coffee Liqueur`)
    ).toEqual([
      "St. Germain",
      "Simple Syrup",
      "Mr. Black Cold Brew Coffee Liqueur",
    ]);
  });

  it("counts fresh lime juice and lime juice as one thing", () => {
    expect(
      namesIn(`## Ingredients
- 1 oz Fresh Lime Juice
- 1 oz lime juice, freshly squeezed
- 1 oz freshly brewed espresso`)
    ).toEqual(["Lime Juice", "espresso"]);
  });
});

// Most recipes in a real bar turned out to be written with no heading at all:
// the name in bold, a line per ingredient, and the steps as a paragraph.
describe("reading a recipe with no ingredients heading", () => {
  const PAN_AM = `**Pan Am**

1½ oz white rum

½ oz Aperol

¾ oz lemon juice

½ oz egg  white

Combine all ingredients and Dry shake for 10-12sec – then wet shake. Double strain into coupe and garnish with dried orange wheel.`;

  it("takes the lines that start with an amount", () => {
    expect(ingredientsIn(PAN_AM)).toEqual([
      { name: "white rum", amount: "1½ oz" },
      { name: "Aperol", amount: "½ oz" },
      { name: "lemon juice", amount: "¾ oz" },
      { name: "egg white", amount: "½ oz" },
    ]);
  });

  // Without a heading, an amount is all that tells an ingredient from a step.
  it("leaves alone a line that does not say how much", () => {
    expect(
      namesIn(`**Bramble**

2 oz gin
Salted rim and lime wheel garnish
Egg White
Shake and double strain into chilled coupe.
2.
7 Up`)
    ).toEqual(["gin"]);
  });

  it("does not take a numbered step for an ingredient", () => {
    expect(
      namesIn(`**Gimlet**

2 oz gin

1. Stir with ice.
2. Strain into a Nick & Nora glass.`)
    ).toEqual(["gin"]);
  });

  it("skips the drink's own name when the recipe starts with it", () => {
    expect(
      ingredientsIn("69 Shades of Grey – 9/10\n\n2 oz gin\n1 oz lime juice", {
        title: "69 Shades of Grey",
      })
    ).toEqual([
      { name: "gin", amount: "2 oz" },
      { name: "lime juice", amount: "1 oz" },
    ]);
  });

  it("takes a list written with marks, too", () => {
    expect(
      namesIn(
        "Min udgave:\n- 4 Fresh Ripe Blackberries\n- 60ml / 2oz Botanist Gin"
      )
    ).toEqual(["Ripe Blackberries", "Botanist Gin"]);
  });

  it("still says nothing when there are no amounts to go on", () => {
    expect(
      namesIn("**Gin & Tonic**\n\nBotanist Gin and Fevertree Tonic")
    ).toEqual([]);
  });
});
