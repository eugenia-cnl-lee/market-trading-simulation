/**
 * main.js
 *
 * Application coordinator for the trading simulation frontend.
 *
 * Owns:
 * - Initialising application state
 * - Connecting market data, portfolio, analytics, and UI modules
 * - Managing update cycles, user interactions, and trade execution flow
 * - Triggering re-renders after state changes
 *
 * Does not own:
 * - Market data fetching implementation
 * - Portfolio calculation logic
 * - DOM rendering details
 *
 * Design Note:
 * This file orchestrates the system by coordinating modules,
 * ensuring a clean separation between data, logic, and presentation.
 */


/**
 * =========================================
 * STOCK UNIVERSE AND WATCHLIST STATE
 * =========================================
 * STOCK_UNIVERSE:
 * Backend-generated stock universe with metadata
 * such as sector and style.
 *
 * selectedSymbols:
 * Smaller active watchlist used for live market fetching.
 */
let STOCK_UNIVERSE = [];
let selectedSymbols = [];

const MAX_ACTIVE_WATCHLIST_SIZE = 8;
const DEFAULT_ACTIVE_WATCHLIST_SIZE = 8;


/**
 * =========================================
 * MARKET REFRESH CONFIGURATION
 * =========================================
 * REFRESH_INTERVAL_MS:
 * How often the market should auto-update.
 *
 * MANUAL_REFRESH_COOLDOWN_MS:
 * How long the user must wait before clicking
 * the manual refresh button again.
 *
 * The cooldown helps reduce unnecessary API calls
 * from repeated user clicking, which is especially
 * useful when working within free-tier rate limits.
 */
const REFRESH_INTERVAL_MS = 10000;          // Auto-refresh every 10 seconds
const MANUAL_REFRESH_COOLDOWN_MS = 7000;  // Manual refresh cooldown: 7 seconds

// Logging for debugging purposes
console.log("REFRESH_INTERVAL_MS:", REFRESH_INTERVAL_MS);
console.log("MANUAL_REFRESH_COOLDOWN_MS:", MANUAL_REFRESH_COOLDOWN_MS);


/**
 * =========================================
 * SHARED MARKET STATE
 * =========================================
 * latestQuotes:
 * Stores the most recent processed quote data for each symbol.
 * Each quote is normalised and includes:
 * - price, change, changePercent
 * - validity status (isValid)
 * - freshness status (isStale)
 *
 * This acts as the shared data source for:
 * - watchlist rendering
 * - portfolio calculations
 * - insights generation
 * 
 * latestMarketSessions:
 * Stores the most recent market session data for each
 * exchange represented in the active watchlist.
 *
 * This is used to communicate whether each exchange is:
 * - open
 * - pre-market
 * - post-market
 * - closed
 *
 * Unlike marketStatusType, this reflects real-world
 * exchange conditions rather than application refresh state.
 * 
 * isLoadingMarket:
 * Prevents overlapping refresh cycles. If one market
 * fetch is already in progress, another one should not
 * begin until it finishes.
 *
 * marketRefreshTimer:
 * Stores the timer ID for the scheduled auto-refresh loop.
 *
 * lastManualRefreshTime:
 * Tracks when the user last triggered a manual refresh.
 * Used to enforce the cooldown period.
 *
 * lastUpdatedTime:
 * Stores the timestamp of the most recent successful refresh.
 * This is used for user-facing freshness indicators.
 * 
 * lastAttemptedUpdateTime:
 * Stores the timestamp of the most recent refresh attempt,
 * regardless of whether it succeeded or failed.
 *
 * marketStatusType:
 * Tracks the current update state for UI messaging.
 * Possible values:
 * - "idle"     → no data loaded yet
 * - "loading"  → refresh in progress
 * - "success"  → all quotes updated successfully
 * - "partial"  → some quotes updated, others stale
 * - "error"    → no valid quotes could be retrieved
 */
let latestQuotes = {};
let latestMarketSessions = {};
let isLoadingMarket = false;
let marketRefreshTimer = null;
let lastManualRefreshTime = 0;
let lastUpdatedTime = null;
let lastAttemptedUpdateTime = null;
let marketStatusType = "idle";
let marketStatusTimer = null;


/**
 * Returns metadata for a given symbol
 */
function getStockMeta(symbol) {
    return STOCK_UNIVERSE.find(s => s.symbol === symbol) || {
        symbol,
        exchange: "US",
        region: "North America",
        sector: "Other",
        style: "core"
    };
}

/**
 * Extract unique exchanges from selected symbols
 */
function getSelectedExchanges() {
    const exchanges = new Set();

    for (const symbol of selectedSymbols) {
        const meta = getStockMeta(symbol);
        if (meta?.exchange) {
            exchanges.add(meta.exchange);
        }
    }

    return [...exchanges];
}

/**
 * Fetch sessions for all exchanges
 */
async function loadMarketSessions() {
    const exchanges = getSelectedExchanges();
    const sessions = {};

    for (const exchange of exchanges) {
        try {
            sessions[exchange] = await fetchMarketSession(exchange);
        } catch (error) {
            console.error(`Failed session for ${exchange}`, error);
            sessions[exchange] = null;
        }
    }

    latestMarketSessions = sessions;
}


/**
 * Fetches the automated stock universe from the backend.
 *
 * Behaviour:
 * - loads a generated US stock universe with metadata
 * - stores the full universe in shared state
 * - selects a smaller default active watchlist for live quotes
 *
 * Design Note:
 * The backend owns universe generation and caching so the
 * frontend stays lightweight and does not fan out many
 * provider requests directly.
 */
async function loadStockUniverse() {
    const response = await fetch("/api/stock-universe?limit=30");

    if (!response.ok) {
        throw new Error(`Failed to load stock universe: HTTP ${response.status}`);
    }

    const universe = await response.json();

    if (!Array.isArray(universe) || universe.length === 0) {
        throw new Error("Stock universe is empty or invalid");
    }

    STOCK_UNIVERSE = universe;

    selectedSymbols = STOCK_UNIVERSE
        .slice(0, DEFAULT_ACTIVE_WATCHLIST_SIZE)
        .map(stock => stock.symbol);

    console.log("Loaded stock universe:", STOCK_UNIVERSE.length);
    console.log("Selected symbols:", selectedSymbols);
}


/**
 * Adds one stock to the active watchlist if possible.
 *
 * Rules:
 * - symbol must exist in the generated universe
 * - duplicates are ignored
 * - active watchlist is capped for API safety and UI clarity
 */
function addSelectedStockToWatchlist(symbol) {
    if (!symbol) {
        return { success: false, message: "No stock selected" };
    }

    const existsInUniverse = STOCK_UNIVERSE.some(stock => stock.symbol === symbol);

    if (!existsInUniverse) {
        return { success: false, message: "Selected stock is not in the universe" };
    }

    if (selectedSymbols.includes(symbol)) {
        return { success: false, message: "Stock is already in the watchlist" };
    }

    if (selectedSymbols.length >= MAX_ACTIVE_WATCHLIST_SIZE) {
        return {
            success: false,
            message: `Watchlist can only contain ${MAX_ACTIVE_WATCHLIST_SIZE} stocks`
        };
    }

    selectedSymbols.push(symbol);
    return { success: true, message: `${symbol} added to watchlist` };
}

/**
 * Removes one stock from the active watchlist.
 *
 * Rules:
 * - symbol must exist in the active watchlist
 * - at least one stock should remain
 */
function removeStockFromWatchlist(symbol) {
    if (!selectedSymbols.includes(symbol)) {
        return { success: false, message: "Stock is not in the watchlist" };
    }

    if (selectedSymbols.length <= 1) {
        return { success: false, message: "Watchlist must keep at least one stock" };
    }

    selectedSymbols = selectedSymbols.filter(item => item !== symbol);

    // Remove stale quote state for removed symbols so the
    // shared quote cache matches the active watchlist.
    delete latestQuotes[symbol];

    return { success: true, message: `${symbol} removed from watchlist` };
}

/**
 * Handles add-stock button clicks from the selector UI.
 */
async function handleAddStock() {
    const selector = document.getElementById("stock-selector");

    if (!selector) {
        return;
    }

    const symbol = selector.value;
    const result = addSelectedStockToWatchlist(symbol);

    alert(result.message);

    if (!result.success) {
        return;
    }

    renderStockSelector();

    const didRefreshSucceed = await loadMarket();

    if (didRefreshSucceed) {
        resetMarketAutoRefresh();
    }
}

/**
 * Handles removing one stock from the active watchlist.
 */
async function handleRemoveStock(symbol) {
    const result = removeStockFromWatchlist(symbol);

    alert(result.message);

    if (!result.success) {
        return;
    }

    renderStockSelector();

    const didRefreshSucceed = await loadMarket();

    if (didRefreshSucceed) {
        resetMarketAutoRefresh();
    }
}


/**
 * =========================================
 * MARKET STATUS TIMING
 * =========================================
 * Supports the live market status display by:
 * - formatting absolute and relative timestamps
 * - scheduling status re-renders over time
 * - keeping relative time indicators in sync
 *
 * This section does not render DOM elements directly.
 * Instead, it supports the UI layer by triggering
 * periodic re-renders of the market status display.
 *
 * A dedicated ticker is used to re-render the status in
 * sync with whole-second boundaries. This ensures relative
 * time indicators (e.g. "3s ago") update smoothly and
 * consistently between market refresh cycles.
 */

/**
 * Formats a Date object into a readable date + time string.
 * Example: 16 Apr 2026, 14:32:10
 */
function formatStatusDateTime(date) {
    return date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

/**
 * Computes a human-readable relative time string based on
 * the difference between the current time and a given timestamp.
 *
 * Used by the status UI to communicate data freshness,
 * especially when distinguishing between live updates,
 * stale data, and delayed refresh outcomes.
 */
function getRelativeTimeString(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
}


/**
 * Schedules market status re-rendering in sync with the
 * next whole-second boundary so relative time text
 * updates more consistently, even when no new market
 * data is fetched between refresh cycles.
 */
function scheduleNextMarketStatusRender() {
    renderMarketStatus();

    const now = Date.now();
    const delayUntilNextSecond = 1000 - (now % 1000);

    marketStatusTimer = setTimeout(scheduleNextMarketStatusRender, delayUntilNextSecond);
}

/**
 * Starts live market status ticking if it has not
 * already been started.
 */
function startMarketStatusTicker() {
    if (marketStatusTimer !== null) {
        return;
    }

    scheduleNextMarketStatusRender();
}

/**
 * Stops live market status ticking if needed.
 */
function stopMarketStatusTicker() {
    if (marketStatusTimer === null) {
        return;
    }

    clearTimeout(marketStatusTimer);
    marketStatusTimer = null;
}


/**
 * =========================================
 * MARKET LOADING
 * =========================================
 * Fetches and processes quote data for the current watchlist,
 * then updates all major parts of the interface:
 * - market watchlist
 * - market session indicator
 * - portfolio summary
 * - holdings
 * - transaction history
 * - insight summary
 * - detailed insights
 *
 * This function acts as the single refresh pipeline used by:
 * - automatic timed polling
 * - manual refresh button clicks
 *
 * Behaviour:
 * - Prevents overlapping refresh cycles using a loading guard
 * - Records both attempted and successful update timestamps
 * - Processes quote data through a validation and fallback layer
 * - Supports partial success (some quotes may be stale)
 *
 * Refresh outcomes:
 * - success → all quotes updated successfully
 * - partial → some quotes updated, others reused from previous state
 * - error   → no valid quotes available
 *
 * Returns:
 * - true if at least one valid quote is available after refresh
 * - false if the refresh produced no usable data or was skipped
 *
 * Design Note:
 * This function separates data fetching reliability concerns
 * from UI rendering and portfolio logic, ensuring that invalid
 * or missing market data does not propagate into the rest of
 * the system.
 *
 * It also keeps real-world market session state separate from
 * application refresh state so unchanged prices are not
 * misinterpreted as system failure.
 */
async function loadMarket() {
    if (isLoadingMarket) {
        return false;
    }

    marketStatusType = "loading";
    renderMarketStatus();

    isLoadingMarket = true;
    lastAttemptedUpdateTime = new Date();

    try {
        const marketResult = await getQuotes(selectedSymbols, latestQuotes);
        latestQuotes = marketResult.quotes;

        // Multi-exchange session fetch
        await loadMarketSessions();

        const insights = generateInsights(latestQuotes);

        if (marketResult.allSucceeded) {
            lastUpdatedTime = new Date();
            marketStatusType = "success";
        } else if (marketResult.partiallySucceeded) {
            lastUpdatedTime = new Date();
            marketStatusType = "partial";
        } else {
            marketStatusType = "error";
        }

        renderWatchlist(latestQuotes);
        renderMarketSession(latestMarketSessions);
        renderPortfolioSummary(latestQuotes);
        renderHoldings(latestQuotes);
        renderTransactions();
        renderInsightSummary(insights);
        renderInsights(insights);

        return !marketResult.allFailed;
    } catch (error) {
        console.error("Failed to load market data:", error);
        marketStatusType = "error";
        alert(`Unable to refresh market data right now: ${error.message}`);
        return false;
    } finally {
        isLoadingMarket = false;
        renderMarketStatus();
    }
}


/**
 * =========================================
 * USER ACTION HANDLERS
 * =========================================
 * Handles buy/sell actions and updates all
 * portfolio-related UI components.
 *
 * Behaviour:
 * - reads the latest processed quote from shared state
 * - passes market session and quote data into the
 *   portfolio execution layer
 * - rerenders portfolio and insight sections only
 *   after execution succeeds
 *
 * Design Note:
 * These handlers coordinate trade attempts but do not
 * own execution rules themselves. This keeps execution
 * realism inside the portfolio module while allowing
 * the main application flow to remain orchestration-focused.
 */

/**
 * Attempts to buy 1 unit of the selected stock using
 * the latest processed quote and current market session,
 * then rerenders all portfolio and insight sections
 * if execution succeeds.
 */
function handleBuy(symbol) {
    const quote = latestQuotes[symbol];

    const meta = getStockMeta(symbol);
    const session = meta ? latestMarketSessions[meta.exchange] : null;

    const result = buyStock(symbol, quote, session);

    alert(result.message);

    if (!result.success) return;

    const insights = generateInsights(latestQuotes);

    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
    renderInsightSummary(insights);
    renderInsights(insights);
}

/**
 * Attempts to sell 1 unit of the selected stock using
 * the latest processed quote and current market session,
 * then rerenders all portfolio and insight sections
 * if execution succeeds.
 */
function handleSell(symbol) {
    const quote = latestQuotes[symbol];

    const meta = getStockMeta(symbol);
    const session = meta ? latestMarketSessions[meta.exchange] : null;

    const result = sellStock(symbol, quote, session);

    alert(result.message);

    if (!result.success) return;

    const insights = generateInsights(latestQuotes);

    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
    renderInsightSummary(insights);
    renderInsights(insights);
}


/**
 * =========================================
 * AUTO-REFRESH CONTROL
 * =========================================
 * Starts and stops the timed market polling loop.
 *
 * The timer repeatedly calls loadMarket() using the
 * configured refresh interval.
 */

/**
 * Starts automatic market refreshing if it has not
 * already been started.
 *
 * Unlike setInterval(), this schedules the next refresh
 * only after the current refresh cycle has completed.
 * This keeps the user-visible gap between updates closer
 * to the configured refresh interval.
 */
function startMarketAutoRefresh() {
    if (marketRefreshTimer !== null) {
        return;
    }

    scheduleNextMarketRefresh();
}

/**
 * Schedules the next automatic market refresh.
 */
function scheduleNextMarketRefresh() {
    marketRefreshTimer = setTimeout(async () => {
        await loadMarket();
        scheduleNextMarketRefresh();
    }, REFRESH_INTERVAL_MS);
}

/**
 * Stops automatic market refreshing if a timer is active.
 */
function stopMarketAutoRefresh() {
    if (marketRefreshTimer === null) {
        return;
    }

    clearTimeout(marketRefreshTimer);
    marketRefreshTimer = null;
}

/**
 * Resets the automatic market refresh timer so the next
 * polling cycle starts counting from the latest manual
 * refresh.
 *
 * This prevents the previous auto-refresh schedule from
 * firing too soon after a user-triggered refresh.
 */
function resetMarketAutoRefresh() {
    if (marketRefreshTimer !== null) {
        clearTimeout(marketRefreshTimer);
        marketRefreshTimer = null;
    }

    startMarketAutoRefresh();
}


/**
 * =========================================
 * MANUAL REFRESH BUTTON CONTROL
 * =========================================
 * Handles:
 * - cooldown enforcement
 * - button disabling
 * - button text updates
 *
 * This lets the user manually refresh the market,
 * while also discouraging rapid repeated clicks
 * that could waste API calls.
 */

/**
 * Updates the refresh button state based on the
 * remaining manual refresh cooldown.
 *
 * Behaviour:
 * - If cooldown is active, disable the button and show
 *   the remaining wait time.
 * - If cooldown has ended, re-enable the button and
 *   restore the normal label.
 */
function updateRefreshButtonState() {
    const refreshButton = document.getElementById("refresh-btn");

    if (!refreshButton) {
        return;
    }

    const timeSinceLastRefresh = Date.now() - lastManualRefreshTime;
    const cooldownRemaining = MANUAL_REFRESH_COOLDOWN_MS - timeSinceLastRefresh;

    if (cooldownRemaining > 0) {
        const secondsRemaining = Math.ceil(cooldownRemaining / 1000);

        refreshButton.disabled = true;
        refreshButton.textContent = `Refresh in ${secondsRemaining}s`;
    } else {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh Now";
    }
}

/**
 * Handles user-triggered manual refreshes.
 *
 * Rules:
 * - If the market is already loading, ignore the click.
 * - If the cooldown period has not passed, ignore the click.
 * - Otherwise, record the manual refresh time, update the
 *   button state immediately, trigger a market refresh,
 *   and restart the auto-refresh timer only if the refresh
 *   succeeds.
 */
async function handleManualRefresh() {
    if (isLoadingMarket) {
        return;
    }

    const timeSinceLastRefresh = Date.now() - lastManualRefreshTime;

    if (timeSinceLastRefresh < MANUAL_REFRESH_COOLDOWN_MS) {
        updateRefreshButtonState();
        return;
    }

    lastManualRefreshTime = Date.now();
    updateRefreshButtonState();

    const didRefreshSucceed = await loadMarket();

    if (didRefreshSucceed) {
        resetMarketAutoRefresh();
    }
}


/**
 * =========================================
 * INITIALISATION
 * =========================================
 * Sets up the application on page load:
 * - binds user interaction handlers
 * - performs the initial market data fetch
 * - starts automatic market polling only after
 *   the first load has completed
 * - starts UI update loops for dynamic elements
 *
 * This ensures the first visible auto-refresh gap
 * matches the configured refresh interval rather
 * than being shortened by the duration of the
 * initial market load.
 */
async function initialiseApp() {
    // Bind manual reset button and add stock button
    document.getElementById("refresh-btn")?.addEventListener("click", handleManualRefresh);
    document.getElementById("add-stock-btn")?.addEventListener("click", handleAddStock);

    /**
     * Updates the refresh button cooldown display every second
     * so the countdown (e.g. "Refresh in 5s") remains accurate.
     */
    setInterval(updateRefreshButtonState, 1000);

    // Start live market status ticking
    startMarketStatusTicker();

    // Render initial UI states
    renderMarketStatus();
    updateRefreshButtonState();

    await loadStockUniverse();
    renderStockSelector();

    // Perform the first market load before starting
    // the automatic refresh cycle
    await loadMarket();

    // Start automatic timed refresh cycle only after
    // the initial load has completed
    startMarketAutoRefresh();
}

initialiseApp();