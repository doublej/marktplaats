// localStorage-backed stores for favorites and search history

const FAVORITES_KEY = 'mp_favorites';
const SEARCH_HISTORY_KEY = 'mp_search_history';
const MAX_SEARCH_HISTORY = 20;

export interface SearchHistoryEntry {
	query: string;
	timestamp: number;
}

// Favorites store
function loadFavorites(): Set<string> {
	if (typeof localStorage === 'undefined') return new Set();
	const stored = localStorage.getItem(FAVORITES_KEY);
	if (!stored) return new Set();
	try {
		return new Set(JSON.parse(stored));
	} catch {
		return new Set();
	}
}

function saveFavorites(favorites: Set<string>): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
}

export function addFavorite(listingId: string): void {
	const favorites = loadFavorites();
	favorites.add(listingId);
	saveFavorites(favorites);
}

export function removeFavorite(listingId: string): void {
	const favorites = loadFavorites();
	favorites.delete(listingId);
	saveFavorites(favorites);
}

export function toggleFavorite(listingId: string): boolean {
	const favorites = loadFavorites();
	const isFav = favorites.has(listingId);
	if (isFav) {
		favorites.delete(listingId);
	} else {
		favorites.add(listingId);
	}
	saveFavorites(favorites);
	return !isFav;
}

export function isFavorite(listingId: string): boolean {
	return loadFavorites().has(listingId);
}

export function getFavorites(): string[] {
	return Array.from(loadFavorites());
}

export function clearFavorites(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(FAVORITES_KEY);
}

// Search history store
function loadSearchHistory(): SearchHistoryEntry[] {
	if (typeof localStorage === 'undefined') return [];
	const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
	if (!stored) return [];
	try {
		return JSON.parse(stored);
	} catch {
		return [];
	}
}

function saveSearchHistory(history: SearchHistoryEntry[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

export function addSearchHistory(query: string): void {
	if (!query.trim()) return;
	const history = loadSearchHistory();
	const normalized = query.trim();
	const filtered = history.filter((e) => e.query !== normalized);
	filtered.unshift({ query: normalized, timestamp: Date.now() });
	saveSearchHistory(filtered.slice(0, MAX_SEARCH_HISTORY));
}

export function getSearchHistory(): SearchHistoryEntry[] {
	return loadSearchHistory();
}

export function removeSearchHistoryEntry(query: string): void {
	const history = loadSearchHistory();
	saveSearchHistory(history.filter((e) => e.query !== query));
}

export function clearSearchHistory(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(SEARCH_HISTORY_KEY);
}

// Search preferences: location filters, remembered between searches
const SEARCH_PREFS_KEY = 'mp_search_prefs';

export interface SearchPrefs {
	zipCode: string;
	distance: number | undefined;
}

const EMPTY_PREFS: SearchPrefs = { zipCode: '', distance: undefined };

export function getSearchPrefs(): SearchPrefs {
	if (typeof localStorage === 'undefined') return EMPTY_PREFS;
	const stored = localStorage.getItem(SEARCH_PREFS_KEY);
	if (!stored) return EMPTY_PREFS;
	try {
		const parsed = JSON.parse(stored);
		return { zipCode: parsed.zipCode ?? '', distance: parsed.distance ?? undefined };
	} catch {
		return EMPTY_PREFS;
	}
}

export function saveSearchPrefs(prefs: SearchPrefs): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify(prefs));
}
