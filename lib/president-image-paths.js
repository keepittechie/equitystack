const PRESIDENT_IMAGE_FILES = [
  "Abraham_Lincoln.png",
  "Andrew_Jackson.png",
  "Andrew_Johnson.png",
  "Barack_Obama.png",
  "Benjamin_Harrison.png",
  "Bill_Clinton.png",
  "Calvin_Coolidge.png",
  "Chester_A_Arthur.png",
  "Donald_Trump.jpg",
  "Dwight_D_Eisenhower.png",
  "Franklin_D_Roosevelt.png",
  "Franklin_Pierce.png",
  "George_H_W_Bush.png",
  "George_W_Bush.png",
  "George_Washington.png",
  "Gerald_Ford.png",
  "Grover_Cleveland.png",
  "Harrison.jpg",
  "Harry_S_Truman.png",
  "Herbert_Hoover.png",
  "James_A_Garfield.png",
  "James_Buchanan.png",
  "James_K_Polk.png",
  "James_Madison.png",
  "James_Monroe.png",
  "Jimmy_Carter.png",
  "Joe_Biden.png",
  "John_Adams.png",
  "John_F_Kennedy.png",
  "John_Quincy_Adams.png",
  "John_Tyler.png",
  "Lyndon_B_Johnson.png",
  "Martin_Van_Buren.png",
  "Millard_Fillmore.png",
  "Richard_Nixon.png",
  "Ronald_Reagan.png",
  "Rutherford_B_Hayes.png",
  "Theodore_Roosevelt.png",
  "Thomas_Jefferson.png",
  "Ulysses_S_Grant.png",
  "Warren_G_Harding.png",
  "William_McKinley.png",
  "William_Taft.png",
  "Woodrow_Wilson.png",
  "Zachary_Taylor.png",
];
const SUFFIX_TOKENS = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

const MANUAL_IMAGE_ALIASES = new Map(
  Object.entries({
    "barack h obama": "Barack_Obama.png",
    "barack hussein obama": "Barack_Obama.png",
    "donald j trump": "Donald_Trump.jpg",
    "donald j trump 2025": "Donald_Trump.jpg",
    "gerald r ford": "Gerald_Ford.png",
    "james earl carter jr": "Jimmy_Carter.png",
    "joseph r biden jr": "Joe_Biden.png",
    "richard m nixon": "Richard_Nixon.png",
    "william h taft": "William_Taft.png",
    "william henry harrison": "Harrison.jpg",
    "william j clinton": "Bill_Clinton.png",
    "william jefferson clinton": "Bill_Clinton.png",
  })
);

function normalizePresidentKey(value) {
  return String(value || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripSuffixTokens(tokens) {
  const trimmed = [...tokens];

  while (trimmed.length > 1 && SUFFIX_TOKENS.has(trimmed[trimmed.length - 1])) {
    trimmed.pop();
  }

  return trimmed;
}

function buildCandidateKeys(value) {
  const normalized = normalizePresidentKey(value);

  if (!normalized) {
    return [];
  }

  const variants = new Set([normalized]);
  const tokens = stripSuffixTokens(normalized.split(" ").filter(Boolean));

  if (!tokens.length) {
    return Array.from(variants);
  }

  variants.add(tokens.join(" "));

  if (tokens.length > 1) {
    variants.add(`${tokens[0]} ${tokens[tokens.length - 1]}`);
  }

  const noMiddleInitials = tokens.filter(
    (token, index) => index === 0 || index === tokens.length - 1 || token.length > 1
  );

  if (noMiddleInitials.length) {
    variants.add(noMiddleInitials.join(" "));

    if (noMiddleInitials.length > 1) {
      variants.add(`${noMiddleInitials[0]} ${noMiddleInitials[noMiddleInitials.length - 1]}`);
    }
  }

  return Array.from(variants);
}

function buildPresidentImageIndex() {
  const imageIndex = new Map();

  for (const fileName of PRESIDENT_IMAGE_FILES) {
    const src = `/presidents/images/${fileName}`;
    const baseName = fileName.replace(/\.[a-z0-9]+$/i, "");

    for (const key of buildCandidateKeys(baseName)) {
      if (!imageIndex.has(key)) {
        imageIndex.set(key, src);
      }
    }
  }

  return imageIndex;
}

const PRESIDENT_IMAGE_INDEX = buildPresidentImageIndex();

export function resolvePresidentImageSrc({ presidentSlug, presidentName } = {}) {
  const candidateKeys = [
    ...buildCandidateKeys(presidentSlug),
    ...buildCandidateKeys(presidentName),
  ];

  for (const key of candidateKeys) {
    const aliasedFile = MANUAL_IMAGE_ALIASES.get(key);
    if (aliasedFile) {
      return `/presidents/images/${aliasedFile}`;
    }
  }

  for (const key of candidateKeys) {
    const matchedSrc = PRESIDENT_IMAGE_INDEX.get(key);
    if (matchedSrc) {
      return matchedSrc;
    }
  }

  return null;
}
