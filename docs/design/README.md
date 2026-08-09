# The Barkeep redesign

Copies of the design work from Claude Design, kept here so the code and the
design it came from stay together. Project id `82c7be41-ba0f-40f3-b780-86a3f6eec9ac`.

The direction is called **Back Bar**: a kitchen order rail with a nice front of
house. One signal colour and nothing else bright, so "what do I make next" is
answered by contrast rather than by reading.

## What each file is

`tokens.css` is the only file here that becomes real code. It is the colours,
type sizes, spacing and so on, written the way Tailwind v4 wants them. Light and
dark are the same variable names with different values, which is what lets the
pile of `!important` overrides in `frontend/src/index.css` go away.

The `.html` files are pictures, not code. Each one is a page of specimens
showing how something should look, with notes on why. Open one in a browser to
read it.

| File | What it covers |
| --- | --- |
| `components.html` | Buttons, fields, cards, chips, tabs, modals, empty states |
| `guest-shell.html` | How a guest moves around, and where the live order sits |
| `guest-menu.html` | The menu itself, on a phone and on a laptop |
| `order-status.html` | The five steps an order goes through, as the guest sees them |
| `admin-shell.html` | The bartender's navigation |
| `bartender-queue.html` | The order queue |
| `admin-screens.html` | Drink menu, drink form, categories, settings, reports, QR |
| `entry-states.html` | Landing, sign in, arriving by QR code, and errors |

`support.js` is what the `.html` files need in order to draw themselves. It is
not part of the app and nothing in `frontend/` should import it.

Two more pages are still in the Claude Design project and were not copied here:
the token swatch sheet, which says the same thing `tokens.css` does, and the
first-round comparison of three directions, which is only of interest as a
record of why Back Bar was chosen.

## Reading the token names

Names say what a thing is for, not what colour it is — `surface`, `text-muted`,
`border`, `accent`. A component asks for the role and gets the right value in
both light and dark without a `dark:` anywhere.

The one rule worth knowing before touching anything: **the signal yellow means
an order is ready to collect, and nothing else.** It is the only bright thing in
the product, and it stops working the moment it is used for a second purpose.
