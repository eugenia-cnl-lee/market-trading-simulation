/**
 * marketData.js
 *
 * Market data access and processing layer.
 *
 * Owns:
 * - Fetching live market data from the backend API
 * - Fetching market session data from the backend API
 * - Normalising raw API responses into a consistent internal format
 * - Validating market data before it enters the application
 * - Managing data reliability and fallback behaviour
 *
 * Does not own:
 * - Portfolio logic
 * - UI rendering
 * - Application orchestration
 *
 * Design Note:
 * This module abstracts the data source, allowing the system
 * to switch from REST polling to real-time streaming without
 * impacting other parts of the application.
 */


/**
 * =========================================
 * TEST MODE (FOR DEMONSTRATION)
 * =========================================
 * Allows simulation of API failure scenarios:
 * - "none"    → normal behaviour
 * - "full"    → all quotes fail
 * - "partial" → selected symbols fail
 *
 * This section is intended for testing and demonstration
 * and is the only section which should be edited for testing
 * purposes.
 */
const TEST_MODE = "none"; // "none" | "full" | "partial"

// For partial failure, choose which stock to break
const TEST_FAIL_SYMBOLS = ["TSLA"];


/**
 * =========================================
 * SOURCE CODE
 * =========================================
 */

/**
 * Fetches one raw quote object from the backend API.
 * This function only handles transport and response parsing.
 */
async function fetchRawQuote(symbol) {
    // Simulate full failure
    if (TEST_MODE === "full") {
        throw new Error(`Simulated full failure for ${symbol}`);
    }

    // Simulate partial failure
    if (TEST_MODE === "partial" && TEST_FAIL_SYMBOLS.includes(symbol)) {
        throw new Error(`Simulated partial failure for ${symbol}`);
    }

    const response = await fetch(`/api/quote?symbol=${symbol}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while fetching ${symbol}`);
    }

    const data = await response.json();
    return data;
}

/**
 * Converts a raw API quote into the application's internal quote format.
 * This prevents the rest of the app from depending directly on API field names.
 */
function normaliseQuote(symbol, rawQuote) {
    return {
        symbol: symbol,
        price: Number(rawQuote?.c),
        change: Number(rawQuote?.d),
        changePercent: Number(rawQuote?.dp),
        fetchedAt: Date.now(),
        isValid: false,
        isStale: false,
        error: null
    };
}

/**
 * Checks whether a normalised quote contains valid numeric data.
 */
function isValidQuote(quote) {
    return (
        typeof quote.symbol === "string" &&
        quote.symbol.length > 0 &&
        Number.isFinite(quote.price) &&
        Number.isFinite(quote.change) &&
        Number.isFinite(quote.changePercent)
    );
}

/**
 * Produces a safe quote result for one symbol.
 *
 * Behaviour:
 * - If the fresh quote is valid, return it as the new live quote
 * - If the fresh quote is invalid but a previous valid quote exists,
 *   reuse the previous quote and mark it stale
 * - If no usable quote exists, return an invalid placeholder
 */
async function getQuote(symbol, previousQuote = null) {
    try {
        const rawQuote = await fetchRawQuote(symbol);
        const quote = normaliseQuote(symbol, rawQuote);

        if (isValidQuote(quote)) {
            quote.isValid = true;
            return quote;
        }

        if (previousQuote?.isValid) {
            return {
                ...previousQuote,
                isStale: true,
                error: `Invalid fresh quote received for ${symbol}. Using last known good quote.`
            };
        }

        return {
            symbol: symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            fetchedAt: Date.now(),
            isValid: false,
            isStale: true,
            error: `Invalid quote received for ${symbol}.`
        };
    } catch (error) {
        if (previousQuote?.isValid) {
            return {
                ...previousQuote,
                isStale: true,
                error: `Failed to refresh ${symbol}. Using last known good quote.`
            };
        }

        return {
            symbol: symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            fetchedAt: Date.now(),
            isValid: false,
            isStale: true,
            error: error.message || `Failed to fetch ${symbol}.`
        };
    }
}


/**
 * =========================================
 * MARKET SESSION DATA
 * =========================================
 * Fetches and normalises trading session state for a
 * configured exchange, such as:
 * - pre-market
 * - regular
 * - post-market
 * - closed
 *
 * This is kept separate from quote fetching because
 * market session describes real-world exchange conditions,
 * not system refresh behaviour.
 */

/**
 * Fetches raw market session data for a given exchange.
 * This function only handles transport and response parsing.
 */
async function fetchRawMarketSession(exchange = "US") {
    const response = await fetch(`/api/market-status?exchange=${exchange}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while fetching market session for ${exchange}`);
    }

    const data = await response.json();
    return data;
}

/**
 * Converts raw market session data into the application's
 * internal market session format.
 *
 * This prevents the rest of the app from depending directly
 * on API field names or incomplete API responses.
 */
function normaliseMarketSession(rawSession) {
    return {
        exchange: typeof rawSession?.exchange === "string" ? rawSession.exchange : "US",
        isOpen: rawSession?.isOpen === true,
        session: rawSession?.session ?? null,
        timezone: typeof rawSession?.timezone === "string" ? rawSession.timezone : null,
        holiday: rawSession?.holiday ?? null,
        fetchedAt: Date.now()
    };
}

/**
 * Checks whether a normalised market session object contains
 * usable session information.
 */
function isValidMarketSession(sessionData) {
    const validSessions = ["pre-market", "regular", "post-market", null];

    return (
        typeof sessionData.exchange === "string" &&
        typeof sessionData.isOpen === "boolean" &&
        validSessions.includes(sessionData.session) &&
        (typeof sessionData.timezone === "string" || sessionData.timezone === null)
    );
}

/**
 * Fetches and normalises market session data safely.
 *
 * Behaviour:
 * - Returns the current market session if valid session data is received
 * - Returns null if the fetch fails or the session data is invalid
 *
 * This keeps market session awareness as optional supporting context
 * rather than a hard dependency for quote loading.
 */
async function fetchMarketSession(exchange = "US") {
    try {
        const rawSession = await fetchRawMarketSession(exchange);
        const sessionData = normaliseMarketSession(rawSession);

        if (isValidMarketSession(sessionData)) {
            return sessionData;
        }

        return null;
    } catch (error) {
        console.error(`Failed to fetch market session for ${exchange}:`, error);
        return null;
    }
}


/**
 * Fetches all watchlist quotes safely.
 *
 * Fresh live quotes are counted as successful updates, while
 * stale fallback quotes remain usable but do not count as
 * successful refreshes.
 *
 * Returns structured market results so the app can distinguish between:
 * - full success
 * - partial success
 * - full failure
 */
async function getQuotes(symbols, previousQuotes = {}) {
    const quotes = {};
    let validCount = 0;

    for (const symbol of symbols) {
        const previousQuote = previousQuotes[symbol] || null;
        const quote = await getQuote(symbol, previousQuote);

        quotes[symbol] = quote;

        if (quote.isValid && !quote.isStale) {
            validCount += 1;
        }
    }

    return {
        quotes: quotes,
        allSucceeded: validCount === symbols.length,
        partiallySucceeded: validCount > 0 && validCount < symbols.length,
        allFailed: validCount === 0
    };
}