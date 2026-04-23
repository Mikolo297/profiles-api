// Country name → ISO code map for NL parsing
const COUNTRY_MAP = {
  'nigeria': 'NG', 'nigerian': 'NG',
  'ghana': 'GH', 'ghanaian': 'GH',
  'kenya': 'KE', 'kenyan': 'KE',
  'south africa': 'ZA', 'south african': 'ZA',
  'ethiopia': 'ET', 'ethiopian': 'ET',
  'tanzania': 'TZ', 'tanzanian': 'TZ',
  'uganda': 'UG', 'ugandan': 'UG',
  'angola': 'AO', 'angolan': 'AO',
  'cameroon': 'CM', 'cameroonian': 'CM',
  'senegal': 'SN', 'senegalese': 'SN',
  'mali': 'ML', 'malian': 'ML',
  'niger': 'NE', 'nigerien': 'NE',
  'burkina faso': 'BF',
  'guinea': 'GN', 'guinean': 'GN',
  'benin': 'BJ', 'beninese': 'BJ',
  'togo': 'TG', 'togolese': 'TG',
  'ivory coast': 'CI', "cote d'ivoire": 'CI',
  'egypt': 'EG', 'egyptian': 'EG',
  'algeria': 'DZ', 'algerian': 'DZ',
  'morocco': 'MA', 'moroccan': 'MA',
  'tunisia': 'TN', 'tunisian': 'TN',
  'libya': 'LY', 'libyan': 'LY',
  'sudan': 'SD', 'sudanese': 'SD',
  'dr congo': 'CD', 'congo': 'CG',
  'mozambique': 'MZ', 'mozambican': 'MZ',
  'zambia': 'ZM', 'zambian': 'ZM',
  'zimbabwe': 'ZW', 'zimbabwean': 'ZW',
  'malawi': 'MW', 'malawian': 'MW',
  'rwanda': 'RW', 'rwandan': 'RW',
  'somalia': 'SO', 'somali': 'SO',
  'madagascar': 'MG', 'malagasy': 'MG',
  'united states': 'US', 'usa': 'US', 'america': 'US', 'american': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'britain': 'GB', 'british': 'GB',
  'france': 'FR', 'french': 'FR',
  'germany': 'DE', 'german': 'DE',
  'india': 'IN', 'indian': 'IN',
  'china': 'CN', 'chinese': 'CN',
  'brazil': 'BR', 'brazilian': 'BR',
  'russia': 'RU', 'russian': 'RU',
  'japan': 'JP', 'japanese': 'JP',
  'indonesia': 'ID', 'indonesian': 'ID',
  'pakistan': 'PK', 'pakistani': 'PK',
  'bangladesh': 'BD', 'bangladeshi': 'BD',
  'mexico': 'MX', 'mexican': 'MX',
  'philippines': 'PH', 'filipino': 'PH',
  'turkey': 'TR', 'turkish': 'TR',
  'iran': 'IR', 'iranian': 'IR',
  'spain': 'ES', 'spanish': 'ES',
  'italy': 'IT', 'italian': 'IT',
  'portugal': 'PT', 'portuguese': 'PT',
  'canada': 'CA', 'canadian': 'CA',
  'australia': 'AU', 'australian': 'AU',
};

/**
 * Parse a natural language query string into filter params.
 * Returns { filters } or { error }
 */
function parseNaturalLanguage(q) {
  if (!q || typeof q !== 'string') return { error: 'Unable to interpret query' };

  const text = q.toLowerCase().trim();
  const filters = {};
  let matched = false;

  // ── Gender ──────────────────────────────────────────────────────────────────
  if (/\bmales?\b/.test(text) && !/\bfemales?\b/.test(text)) {
    filters.gender = 'male';
    matched = true;
  } else if (/\bfemales?\b/.test(text) && !/\bmales?\b/.test(text)) {
    filters.gender = 'female';
    matched = true;
  } else if (/\b(male and female|female and male|both genders?|people|persons?|individuals?)\b/.test(text)) {
    matched = true;
  }

  // ── Age group ───────────────────────────────────────────────────────────────
  if (/\bchildren\b|\bchild\b|\bkids?\b/.test(text)) {
    filters.age_group = 'child';
    matched = true;
  } else if (/\bteenagers?\b|\bteens?\b/.test(text)) {
    filters.age_group = 'teenager';
    matched = true;
  } else if (/\badults?\b/.test(text)) {
    filters.age_group = 'adult';
    matched = true;
  } else if (/\bseniors?\b|\belderly\b|\bold people\b/.test(text)) {
    filters.age_group = 'senior';
    matched = true;
  }

  // ── "young" → ages 16–24 ────────────────────────────────────────────────────
  if (/\byoung\b/.test(text)) {
    filters.min_age = 16;
    filters.max_age = 24;
    matched = true;
  }

  // ── Age comparisons ─────────────────────────────────────────────────────────
  const aboveMatch = text.match(/(?:above|over|older than|greater than)\s+(\d+)/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[1]);
    matched = true;
  }

  const belowMatch = text.match(/(?:below|under|younger than|less than)\s+(\d+)/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[1]);
    matched = true;
  }

  const betweenMatch = text.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1]);
    filters.max_age = parseInt(betweenMatch[2]);
    matched = true;
  }

  const agedMatch = text.match(/aged?\s+(\d+)/);
  if (agedMatch) {
    filters.min_age = parseInt(agedMatch[1]);
    filters.max_age = parseInt(agedMatch[1]);
    matched = true;
  }

  // ── Country ─────────────────────────────────────────────────────────────────
  const sortedCountries = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
  for (const country of sortedCountries) {
    if (text.includes(country)) {
      filters.country_id = COUNTRY_MAP[country];
      matched = true;
      break;
    }
  }

  const fromMatch = text.match(/\bfrom\s+([a-z\s]+?)(?:\s+(?:who|with|aged?|above|below|over|under)|$)/);
  if (fromMatch && !filters.country_id) {
    const countryStr = fromMatch[1].trim();
    if (COUNTRY_MAP[countryStr]) {
      filters.country_id = COUNTRY_MAP[countryStr];
      matched = true;
    }
  }

  if (!matched || Object.keys(filters).length === 0) {
    return { error: 'Unable to interpret query' };
  }

  return { filters };
}

module.exports = { parseNaturalLanguage };
