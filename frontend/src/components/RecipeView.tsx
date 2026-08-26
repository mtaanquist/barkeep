import React from "react";
import { X, Clock, Users, ChefHat } from "lucide-react";
import { useApp } from "../hooks/useApp";
import { useCloseOnEscape } from "../hooks/useCloseOnEscape";
import { useDialogFocus } from "../hooks/useDialogFocus";
import type { DrinkToRead } from "../types";
import { useTranslation } from "../utils/translations";
import { LazyMarkdownViewer } from "./LazyMDEditor";

interface RecipeViewProps {
  drink: DrinkToRead;
  onClose: () => void;
  /** Given only for a bartender. Reading a drink never leads to changing one
      by accident, so editing is its own button rather than the way in. */
  onEdit?: () => void;
}

/**
 * Some bartenders write a line like "prep: 5 min" at the top of a recipe.
 * If one is there it becomes a chip; if not, nothing is missing.
 */
const readMetadata = (recipe: string | null) => {
  if (!recipe) return { difficulty: null, prepTime: null, servings: null };

  const difficulty = recipe.match(/difficulty:\s*(\w+)/i);
  const prepTime = recipe.match(
    /prep(?:\s+time)?:\s*(\d+(?:\s*-\s*\d+)?)\s*(?:min|minutes?)/i
  );
  const servings = recipe.match(
    /(?:serves?|servings?):\s*(\d+(?:\s*-\s*\d+)?)/i
  );

  return {
    difficulty: difficulty ? difficulty[1] : null,
    prepTime: prepTime ? prepTime[1] : null,
    servings: servings ? servings[1] : null,
  };
};

const Chip: React.FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
  onPhoto: boolean;
}> = ({ icon, children, onPhoto }) => (
  <span
    className={`inline-flex items-center gap-1.5 font-mono text-caption uppercase ${
      onPhoto ? "text-sign-fg/90" : "text-text-muted"
    }`}
  >
    {icon}
    {children}
  </span>
);

const RecipeView: React.FC<RecipeViewProps> = ({ drink, onClose, onEdit }) => {
  const { language } = useApp();
  const t = useTranslation(language);

  const metadata = readMetadata(drink.recipe);
  const onPhoto = !!drink.image_url;
  const ingredients = drink.ingredient_names ?? [];
  // The bartender gets the amounts as well; a guest only what goes in.
  const lines = drink.ingredients ?? [];

  useCloseOnEscape(onClose);
  const panel = useDialogFocus<HTMLDivElement>();

  // The bottom padding keeps this clear of the queue bar on a phone, which
  // rides above it so the pending count stays readable while a drink is made.
  return (
    <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4 pb-28 lg:pb-4 overflow-y-auto">
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={drink.title}
        className="w-full max-w-lg my-8 bg-surface-raised border border-border rounded-lg shadow-float overflow-hidden flex flex-col max-h-[90vh] focus:outline-none"
      >
        <div className="relative shrink-0">
          {onPhoto && (
            <div className="h-56 overflow-hidden">
              <img
                src={drink.image_url!}
                alt=""
                className="w-full h-full object-cover"
                style={{
                  transform: `translate(${drink.image_crop_x || 0}%, ${drink.image_crop_y || 0}%) scale(${drink.image_crop_zoom || 1})`,
                }}
              />
              {/* Enough shade under the name to keep it readable. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
          )}

          <div
            className={`${onPhoto ? "absolute inset-x-0 bottom-0" : ""} p-5 pr-16 flex flex-col gap-2`}
          >
            <h2
              className={`text-display break-words ${onPhoto ? "text-sign-fg" : "text-text"}`}
            >
              {drink.title}
            </h2>

            {(drink.base_spirit ||
              metadata.difficulty ||
              metadata.prepTime ||
              metadata.servings) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {drink.base_spirit && (
                  <Chip icon={null} onPhoto={onPhoto}>
                    {t("baseSpirit")} · {drink.base_spirit}
                  </Chip>
                )}
                {metadata.difficulty && (
                  <Chip
                    icon={<ChefHat className="w-3.5 h-3.5" />}
                    onPhoto={onPhoto}
                  >
                    {metadata.difficulty}
                  </Chip>
                )}
                {metadata.prepTime && (
                  <Chip
                    icon={<Clock className="w-3.5 h-3.5" />}
                    onPhoto={onPhoto}
                  >
                    {metadata.prepTime} min
                  </Chip>
                )}
                {metadata.servings && (
                  <Chip
                    icon={<Users className="w-3.5 h-3.5" />}
                    onPhoto={onPhoto}
                  >
                    {t("servings")} {metadata.servings}
                  </Chip>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label={t("close")}
            className={`absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-md transition-colors duration-(--duration-instant) cursor-pointer ${
              onPhoto
                ? "bg-overlay text-sign-fg hover:bg-black/60"
                : "text-text-muted hover:bg-surface-sunken"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 border-t border-border">
          {/* What is in it. For a guest, without how much: that says what the
              drink is, not how to make it, so it is here whether or not the
              recipe is shared — and it is what the guest asks about anyway.
              The bartender, who is about to make it, gets the amounts too. */}
          {(lines.length > 0 || ingredients.length > 0) && (
            <div className="flex flex-col gap-1.5 mb-5">
              <span className="font-mono text-caption uppercase text-text-muted">
                {t("ingredientsKicker")}
              </span>
              {lines.length > 0 ? (
                <ul className="flex flex-col gap-1 text-body text-text">
                  {lines.map((line) => (
                    <li key={line.ingredient_id} className="flex gap-3">
                      {/* Read across a bar, so the same size as the name. */}
                      <span className="w-20 shrink-0 text-text-muted tabular-nums">
                        {line.amount ?? ""}
                      </span>
                      <span>{line.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-text">{ingredients.join(", ")}</p>
              )}
            </div>
          )}

          <LazyMarkdownViewer
            source={drink.recipe ?? ""}
            style={
              // The editor ships its own near-black, which vanishes on a
              // dark panel. Hand it the ink the rest of the app uses.
              {
                background: "none",
                "--color-fg-default": "var(--bk-text)",
              } as React.CSSProperties
            }
          />
        </div>

        <div className="shrink-0 p-4 border-t border-border bg-surface-sunken flex items-center gap-3">
          {/* Nothing is said about stock for a drink that is no longer on the
              menu, rather than calling it sold out. */}
          <p className="flex-1 flex items-center gap-2 text-body text-text-muted">
            {drink.in_stock !== undefined && (
              <>
                {/* Running out is a state, not a fault, so it is not red. */}
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    drink.in_stock === 1 ? "bg-text" : "bg-disabled-fg"
                  }`}
                />
                {drink.in_stock === 1 ? t("inStock") : t("outOfStock")}
              </>
            )}
          </p>

          {/* Editing is the quiet one and sits away from the thumb. Reading a
              drink must not lead to changing it by a stray tap. */}
          {onEdit && (
            <button
              onClick={onEdit}
              className="h-14 px-5 rounded-md border border-border text-label text-text-muted transition-colors duration-(--duration-instant) hover:bg-surface-sunken hover:text-text cursor-pointer"
            >
              {t("edit")}
            </button>
          )}

          <button
            onClick={onClose}
            className="h-14 px-5 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 cursor-pointer"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeView;
