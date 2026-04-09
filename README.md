# Gamechanger Checker

Gamechanger Checker is a small static web app that checks Magic: The Gathering deck lists against Scryfall.
It helps you find cards marked as gamechangers and cards that are not legal in a selected format.

## Hosted App

The project is available at:

https://gcc.antonio.gg/

## What It Does

- Accepts a pasted deck list in common deckbuilder text formats.
- Extracts card names while ignoring quantities, set tags, comments, group headers, blank lines, and the `//Tokens` section.
- Checks the list against Scryfall for:
  - gamechangers
  - cards not legal in the selected format
  - cards that could not be recognized
- Shows matching cards as image links that open their Scryfall pages in a new tab.

## Stack

- HTML
- CSS
- Vanilla JavaScript
- Scryfall API

## How It Works

1. Paste a deck list into the textarea.
2. Choose whether to check gamechangers, legality, or both.
3. Select a format if legality checking is enabled.
4. Press `Check`.
5. The app parses the list, sends batched requests to Scryfall, and renders the results on the page.

For split cards and similar names written as `Card Name // Other Name`, the lookup uses the left side of the name when querying Scryfall.

## Local Usage

No build step or installation is required.

1. Clone this repository.
2. Open `index.html` in your browser.

## Contributing

Contributions should stay small, clear, and aligned with the current scope of the project.

- Open an issue if you find a bug or want to suggest an improvement.
- Keep changes focused and easy to review.
- Prefer simple solutions and avoid adding dependencies unless they are clearly justified.
- If you submit a code change, open a PR with a short explanation of what changed and why.

## Useful Links

- App: https://gcc.antonio.gg/
- Issues: https://github.com/antonio-gg-dev/gamechanger-checker/issues
- Scryfall: https://scryfall.com/
- Scryfall API docs: https://scryfall.com/docs/api
