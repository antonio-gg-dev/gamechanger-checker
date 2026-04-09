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
const notFoundResults = document.querySelector('#not-found-results');
const notFoundList = document.querySelector('#not-found-list');
const restrictedResults = document.querySelector('#restricted-results');
const restrictedList = document.querySelector('#restricted-list');
const bannedResults = document.querySelector('#banned-results');
const bannedList = document.querySelector('#banned-list');
const notLegalResults = document.querySelector('#not-legal-results');
const notLegalList = document.querySelector('#not-legal-list');
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
  results.hidden =
    !message &&
    notFoundResults.hidden &&
    gamechangerResults.hidden &&
    restrictedResults.hidden &&
    bannedResults.hidden &&
    notLegalResults.hidden;
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

function renderCardList(element, cards, options = {}) {
  clearList(element);

  for (const card of cards) {
    const link = document.createElement('a');
    const media = buildCardMedia(card, options);
    const caption = buildCardCaption(card, options);

    link.href = card.scryfall_uri;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.className = 'card-link';

    link.appendChild(media);
    link.appendChild(caption);
    element.appendChild(link);
  }
}

function resetResults() {
  clearList(notFoundList);
  clearList(gamechangerList);
  clearList(restrictedList);
  clearList(bannedList);
  clearList(notLegalList);
  notFoundResults.hidden = true;
  gamechangerResults.hidden = true;
  restrictedResults.hidden = true;
  bannedResults.hidden = true;
  notLegalResults.hidden = true;
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
    .replace(/^\d+x?\s+/i, '')
    .trim();

  const commentMatch = value.match(/\s+#/);

  if (commentMatch) {
    value = value.slice(0, commentMatch.index).trim();
  }

  value = value.replace(/\s+\([A-Z0-9]+\)\s+[A-Z0-9-]+$/i, '').trim();
  value = value.replace(/\s\/\s/g, ' // ');

  return value;
}

function extractSectionName(line) {
  return line.trim().slice(2).trim();
}

function getLookupName(cardName) {
  return cardName.split(' // ')[0].trim();
}

function parseDeckList(text) {
  const cards = [];
  const seen = new Set();
  let currentSection = '';
  let ignoreGroup = false;

  for (const line of text.split('\n')) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('//')) {
      const sectionName = extractSectionName(trimmedLine);
      ignoreGroup = sectionName.toLowerCase() === 'tokens';
      currentSection = ignoreGroup ? '' : sectionName;

      continue;
    }

    if (ignoreGroup) {
      continue;
    }

    const cardName = extractCardName(trimmedLine);
    const cardKey = `${currentSection.toLowerCase()}\u0000${cardName.toLowerCase()}`;

    if (!cardName || seen.has(cardKey)) {
      continue;
    }

    seen.add(cardKey);
    cards.push({
      name: cardName,
      section: currentSection,
    });
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
        name: getLookupName(cardName),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error('Could not query Scryfall.');
  }

  return response.json();
}

async function fetchCards(cardEntries) {
  const batches = chunk(
    [...new Set(cardEntries.map((entry) => getLookupName(entry.name).toLowerCase()))],
    BATCH_SIZE
  );
  const cardsByName = new Map();
  const notFound = [];

  for (const batch of batches) {
    const payload = await fetchCardBatch(batch);

    for (const card of payload.data || []) {
      cardsByName.set(getLookupName(card.name).toLowerCase(), card);
    }

    notFound.push(...(payload.not_found || []));
  }

  const fetchedCards = cardEntries
    .map((entry) => {
      const lookupName = getLookupName(entry.name).toLowerCase();
      const card = cardsByName.get(lookupName);

      if (!card) {
        return null;
      }

      return {
        ...card,
        deckName: entry.name,
        section: entry.section,
      };
    })
    .filter(Boolean);

  return { cards: fetchedCards, notFound };
}

function isGameChanger(card) {
  return card.game_changer === true;
}

function isNotLegal(card, format) {
  return card.legalities?.[format] !== 'legal';
}

function formatCardName(card) {
  return card.deckName || card.name;
}

function getSectionTone(section) {
  switch (section?.toLowerCase()) {
    case 'sideboard':
      return 'sideboard';
    case 'maybeboard':
      return 'maybeboard';
    default:
      return 'default';
  }
}

function formatLegalityStatus(card, format) {
  switch (card.legalities?.[format]) {
    case 'banned':
      return 'Banned';
    case 'restricted':
      return 'Restricted';
    case 'not_legal':
      return 'Not legal';
    case 'legal':
      return 'Legal';
    default:
      return 'Unknown';
  }
}

function getLegalityStatusTone(card, format) {
  if (card.legalities?.[format] === 'restricted') {
    return 'warning';
  }

  return 'danger';
}

function buildCardMedia(card, options = {}) {
  const media = document.createElement('div');
  const imageUrl = getCardImageUrl(card);

  media.className = 'card-media';

  if (imageUrl) {
    const image = document.createElement('img');

    image.src = imageUrl;
    image.alt = card.name;
    image.loading = 'lazy';
    media.appendChild(image);
  } else {
    const placeholder = document.createElement('div');

    placeholder.className = 'card-media-placeholder';
    placeholder.textContent = formatCardName(card);
    media.appendChild(placeholder);
  }

  if (options.showLegalityStatus) {
    const status = document.createElement('span');

    status.className = `card-status-ribbon card-status-ribbon--${getLegalityStatusTone(card, options.format)}`;
    status.textContent = formatLegalityStatus(card, options.format);
    media.appendChild(status);
  }

  return media;
}

function buildCardCaption(card, options = {}) {
  const caption = document.createElement('div');
  const name = document.createElement('p');

  caption.className = 'card-caption';

  name.className = 'card-caption-name';
  name.textContent = formatCardName(card);
  caption.appendChild(name);

  if (card.section) {
    const section = document.createElement('p');

    section.className = `card-caption-section card-caption-section--${getSectionTone(card.section)}`;
    section.textContent = card.section;
    caption.appendChild(section);
  }

  return caption;
}

function renderResults(cards, notFound) {
  const gameChangerCards = gamechangerInput.checked
    ? cards.filter(isGameChanger)
    : [];

  const illegalCards = legalityInput.checked
    ? cards.filter((card) => isNotLegal(card, formatSelect.value))
    : [];
  const restrictedCards = illegalCards.filter((card) => card.legalities?.[formatSelect.value] === 'restricted');
  const bannedCards = illegalCards.filter((card) => card.legalities?.[formatSelect.value] === 'banned');
  const notLegalCards = illegalCards.filter((card) => {
    const legalityStatus = card.legalities?.[formatSelect.value];

    return legalityStatus !== 'restricted' && legalityStatus !== 'banned';
  });

  notFoundResults.hidden = notFound.length === 0;

  if (notFound.length) {
    renderTextList(
      notFoundList,
      notFound.map((entry) => entry.name || 'Unidentified card')
    );
  }

  if (gamechangerInput.checked) {
    gamechangerResults.hidden = gameChangerCards.length === 0;

    if (gameChangerCards.length) {
      renderCardList(gamechangerList, gameChangerCards);
    } else {
      clearList(gamechangerList);
    }
  }

  if (legalityInput.checked) {
    restrictedResults.hidden = restrictedCards.length === 0;
    bannedResults.hidden = bannedCards.length === 0;
    notLegalResults.hidden = notLegalCards.length === 0;

    if (restrictedCards.length) {
      renderCardList(restrictedList, restrictedCards, {
        showLegalityStatus: true,
        format: formatSelect.value,
      });
    } else {
      clearList(restrictedList);
    }

    if (bannedCards.length) {
      renderCardList(bannedList, bannedCards, {
        showLegalityStatus: true,
        format: formatSelect.value,
      });
    } else {
      clearList(bannedList);
    }

    if (notLegalCards.length) {
      renderCardList(notLegalList, notLegalCards, {
        showLegalityStatus: true,
        format: formatSelect.value,
      });
    } else {
      clearList(notLegalList);
    }
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
