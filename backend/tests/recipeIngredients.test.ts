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
});
