# Why "Only 3 left" when 10 are on the shelf

**Goal:** after reading, you can explain why an online shop can show fewer items than it holds, and what happens when two people buy the last one at the same moment.

## The explanation

**The question.** A product page says "Only 3 left". The warehouse shelf holds 10. Is the shop wrong?

**What you already know.** In a real shop, an item in another person's basket is still in the shop. But it is promised. It is not for sale to you.

**What goes wrong.** Online, you cannot see the other baskets. If the shop counted only the shelf, it could sell the same item twice.

**How it works.** The shop keeps two counts. *On hand* is the number of items on the shelf. *Reserved* is the number of items promised to orders. Many shops also reserve an item for a short time while a shopper is in checkout. The page shows on hand minus reserved: 10 − 7 = 3.

**What happens as a result.** The number can go up again. If a shopper leaves checkout, or a hold runs out, the item becomes free.

**Two people, one item.** Two shoppers try to take the last free item. A well-built shop handles each "take one" request in turn. The first request succeeds. The second finds zero and fails. That shopper sees "sold out".

**The usual wrong belief.** "The item in my cart is mine." In many shops, the cart reserves nothing. The item is yours when the order is confirmed.

**Why it matters.** The count stops the shop selling an item that it cannot send.

**Recap.** Shown = on hand − reserved. Holds end. The last item goes to the first confirmed order.

## Five facts

1. An online shop can track more than one count for the same product: items on hand, and items reserved for orders. [S1, S2]
2. The count a shopper sees is usually the items that are free to sell: on hand minus reserved. [S1, S2]
3. Some shops hold an item while a shopper is in checkout, and release it if the checkout does not finish in time. When the hold starts, and how long it lasts, depends on the shop. [S2]
4. When two requests try to change the same count at the same time, a correct system makes the changes one after the other, so that the second request sees the result of the first. [S3, S4]
5. A system that does not do this can sell more items than it has. This is called overselling, and the shop must then cancel or delay an order. [S3, S4]

## Three defined terms

- **On hand:** the number of items that are physically in the warehouse.
- **Reserved:** the number of items on hand that are promised to an order or held for a checkout, so they cannot be sold to another person.
- **Available to sell:** on hand minus reserved. This is the number behind messages such as "Only 3 left".

## Common misconception

"Adding an item to the cart reserves it." In many shops this is false. Many shops reserve an item only at checkout, and some only after payment. Until then, another shopper can buy it.

## Real example (illustrative, not from a named shop)

A shelf holds 10 mugs. Five mugs are in paid orders that are not yet packed. Two shoppers are in checkout with one mug each. The page shows 10 − 5 − 2 = 3, so it says "Only 3 left". One checkout shopper closes the tab. After the hold ends, the page shows 4.

## Facts, assumptions and examples kept apart

- **Facts:** items 1–5 above, as general descriptions of common practice. Each shop decides its own rules.
- **Assumptions:** the shop in the example reserves items at checkout and keeps paid orders reserved until shipping. Not all shops do this.
- **Example:** the 10 mugs and the numbers 5, 2 and 3 are invented for teaching. They are not statistics.

## Sources

- [S1] Wikipedia, "Inventory" — stock held for sale and its accounting. https://en.wikipedia.org/wiki/Inventory
- [S2] General description of e-commerce inventory practice (on hand, committed/reserved, available-to-sell, checkout holds). Terms vary between shop platforms; this is a summary of common practice, not a quote from one vendor. See also Wikipedia, "Available-to-promise". https://en.wikipedia.org/wiki/Available-to-promise
- [S3] Wikipedia, "Race condition". https://en.wikipedia.org/wiki/Race_condition
- [S4] Wikipedia, "Lock (computer science)" and "Optimistic concurrency control" — two common ways a database makes competing changes happen one after the other. https://en.wikipedia.org/wiki/Lock_(computer_science) , https://en.wikipedia.org/wiki/Optimistic_concurrency_control

## Diagram (`diagram.svg`)

**Alt text:** Ten items on a shelf. Five are in paid orders not yet shipped, two are held in checkouts; those seven are reserved. Ten on hand minus seven reserved leaves three free, so the product page shows "Only 3 left".

**Relationships shown:**
1. On hand (10) = paid (5) + held (2) + free (3).
2. Reserved (7) = paid + held (bracket).
3. Arrow "on hand − reserved" → the number the product page shows.

Shape: layers read top to bottom. Box states differ by fill (solid / hatched / outline) and by a word in each box, so the diagram works in grayscale. The extra video images (`photos/shelf.svg`, `basket.svg`, `hold.svg`, `race.svg`) follow the same rules.

## Accessibility notes (`page.html`)

- One input: a native range slider (0–5 shoppers in checkout), labelled, keyboard operable (arrows, Home, End); result announced through an `aria-live` line.
- Reset button returns to 2 and moves focus back to the slider.
- Visible focus ring (3 px coral outline); targets at least 44 px tall.
- `prefers-reduced-motion: reduce` turns off all transitions; nothing on the page depends on motion.
- The inline SVG has `<title>` and `<desc>`; the `desc` and the caption update with the slider. A text-only version of the diagram sits in a `<details>`.
- Steps use native `<details>`, so they open by keyboard and work without JavaScript.
