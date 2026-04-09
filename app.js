const form = document.querySelector('#checker-form');
const deckInput = document.querySelector('#deck-input');
const gamechangerInput = document.querySelector('#check-gamechangers');
const legalityInput = document.querySelector('#check-legality');
const formatSelect = document.querySelector('#format-select');
const errorMessage = document.querySelector('#error-message');
const results = document.querySelector('#results');
const statusMessage = document.querySelector('#status-message');
const gamechangerResults = document.querySelector('#gamechanger-results');
const gamechangerList = document.querySelector('#gamechanger-list');
const legalityResults = document.querySelector('#legality-results');
const legalityList = document.querySelector('#legality-list');
const notFoundResults = document.querySelector('#not-found-results');
const notFoundList = document.querySelector('#not-found-list');
const submitButton = form.querySelector('button[type="submit"]');

const SCRYFALL_COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
const BATCH_SIZE = 75;

function setError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function syncFormatState() {
  formatSelect.disabled = !legalityInput.checked;
}

function setStatus(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = !message;
  results.hidden = !message && gamechangerResults.hidden && legalityResults.hidden;
}

function clearList(element) {
  element.textContent = '';
}

function renderTextList(element, values) {
  clearList(element);

  for (const value of values) {
    const item = document.createElement('li');
    item.textContent = value;
    element.appendChild(item);
  }
}

function setLoadingState(isLoading) {
  deckInput.disabled = isLoading;
  gamechangerInput.disabled = isLoading;
  legalityInput.disabled = isLoading;
  formatSelect.disabled = isLoading || !legalityInput.checked;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? 'Checking...' : 'Check';
}

function getCardImageUrl(card) {
  if (card.image_uris?.normal) {
    return card.image_uris.normal;
  }

  if (card.card_faces?.length) {
    return card.card_faces[0].image_uris?.normal || '';
  }

  return '';
}

function renderCardList(element, cards, formatter) {
  clearList(element);

  for (const card of cards) {
    const link = document.createElement('a');
    const image = document.createElement('img');
    const caption = document.createElement('p');
    const imageUrl = getCardImageUrl(card);

    link.href = card.scryfall_uri;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.className = 'card-link';

    if (imageUrl) {
      image.src = imageUrl;
      image.alt = card.name;
      image.loading = 'lazy';
      link.appendChild(image);
    } else {
      link.textContent = card.name;
    }

    caption.className = 'card-caption';
    caption.textContent = formatter(card);

    link.appendChild(caption);
    element.appendChild(link);
  }
}

function resetResults() {
  clearList(gamechangerList);
  clearList(legalityList);
  clearList(notFoundList);
  gamechangerResults.hidden = true;
  legalityResults.hidden = true;
  notFoundResults.hidden = true;
  results.hidden = true;
  setStatus('');
}

function extractCardName(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith('//')) {
    return '';
  }

  let value = trimmedLine
    .replace(/^\d+x?\s+/i, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();

  const commentMatch = value.match(/\s+#/);

  if (commentMatch) {
    value = value.slice(0, commentMatch.index).trim();
  }

  return value;
}

function parseDeckList(text) {
  const cards = [];
  const seen = new Set();
  let ignoreGroup = false;

  for (const line of text.split('\n')) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('//')) {
      ignoreGroup = trimmedLine.toLowerCase() === '//tokens';
      continue;
    }

    if (ignoreGroup) {
      continue;
    }

    const cardName = extractCardName(trimmedLine);
    const cardKey = cardName.toLowerCase();

    if (!cardName || seen.has(cardKey)) {
      continue;
    }

    seen.add(cardKey);
    cards.push(cardName);
  }

  return cards;
}

function chunk(array, size) {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

async function fetchCardBatch(cards) {
  const response = await fetch(SCRYFALL_COLLECTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      identifiers: cards.map((cardName) => ({
        name: cardName.split(' // ')[0].trim(),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error('Could not query Scryfall.');
  }

  return response.json();
}

async function fetchCards(cardEntries) {
  const batches = chunk(cardEntries, BATCH_SIZE);
  const fetchedCards = [];
  const notFound = [];

  for (const batch of batches) {
    const payload = await fetchCardBatch(batch);

    fetchedCards.push(...(payload.data || []));
    notFound.push(...(payload.not_found || []));
  }

  return { cards: fetchedCards, notFound };
}

function isGameChanger(card) {
  return card.game_changer === true;
}

function isNotLegal(card, format) {
  return card.legalities?.[format] !== 'legal';
}

function renderResults(cards, notFound) {
  const gameChangerCards = gamechangerInput.checked
    ? cards.filter(isGameChanger)
    : [];

  const illegalCards = legalityInput.checked
    ? cards.filter((card) => isNotLegal(card, formatSelect.value))
    : [];

  if (gamechangerInput.checked) {
    gamechangerResults.hidden = gameChangerCards.length === 0;

    if (gameChangerCards.length) {
      renderCardList(gamechangerList, gameChangerCards, (card) => card.name);
    } else {
      clearList(gamechangerList);
    }
  }

  if (legalityInput.checked) {
    legalityResults.hidden = illegalCards.length === 0;

    if (illegalCards.length) {
      renderCardList(
        legalityList,
        illegalCards,
        (card) => `${card.name} (${card.legalities?.[formatSelect.value] || 'unknown'})`
      );
    } else {
      clearList(legalityList);
    }
  }

  notFoundResults.hidden = notFound.length === 0;

  if (notFound.length) {
    renderTextList(
      notFoundList,
      notFound.map((entry) => entry.name || 'Unidentified card')
    );
  }

  const statusMessages = [];

  if (gamechangerInput.checked && !gameChangerCards.length) {
    statusMessages.push('No gamechangers found.');
  }

  if (legalityInput.checked && !illegalCards.length) {
    statusMessages.push('All cards are legal in the selected format.');
  }

  if (notFound.length) {
    statusMessages.push(`${notFound.length} cards were not recognized.`);
  }

  setStatus(statusMessages.join(' '));
  results.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');
  resetResults();

  if (!gamechangerInput.checked && !legalityInput.checked) {
    setError('Select at least one check.');
    return;
  }

  const cards = parseDeckList(deckInput.value);

  if (!cards.length) {
    setError('No valid cards were found.');
    return;
  }

  try {
    setLoadingState(true);
    setStatus('Querying Scryfall...');
    results.hidden = false;

    const { cards: fetchedCards, notFound } = await fetchCards(cards);

    if (!fetchedCards.length) {
      setError('Scryfall did not return any cards for this list.');
      resetResults();
      return;
    }

    renderResults(fetchedCards, notFound);
  } catch (error) {
    setError(error.message || 'The Scryfall request failed.');
    resetResults();
  } finally {
    setLoadingState(false);
  }
});

legalityInput.addEventListener('change', syncFormatState);

syncFormatState();
