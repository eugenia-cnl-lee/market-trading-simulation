/**
 * =========================================
 * WATCHLIST CONFIGURATION
 * =========================================
 * Defines which stocks are shown in the market view.
 */
const WATCHLIST = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"];


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

/**
 * =========================================
 * SHARED MARKET STATE
 * =========================================
 * latestQuotes:
 * Stores the most recently fetched quote data.
 * This acts as the shared quote source for:
 * - watchlist rendering
 * - portfolio calculations
 * - insights generation
 *
 * isLoadingMarket:
 * Prevents overlapping refresh cycles. If one market
 * fetch is already in progress, another one should not
 * begin until it finishes.
 *
 * marketRefreshTimer:
 * Stores the interval ID for timed auto-refresh.
 *
 * lastManualRefreshTime:
 * Tracks when the user last triggered a manual refresh.
 * Used to enforce the cooldown period.
 */
let latestQuotes = {};
let isLoadingMarket = false;
let marketRefreshTimer = null;
let lastManualRefreshTime = 0;


/**
 * =========================================
 * MARKET LOADING
 * =========================================
 * Fetches fresh quote data for the current watchlist,
 * then updates all major parts of the interface:
 * - market watchlist
 * - portfolio summary
 * - holdings
 * - transaction history
 * - insight summary
 * - detailed insights
 *
 * This function is the single refresh pipeline used by:
 * - automatic timed polling
 * - manual refresh button clicks
 *
 * The loading guard ensures that only one fetch/render
 * cycle runs at a time.
 */
async function loadMarket() {
    if (isLoadingMarket) {
        return;
    }

    isLoadingMarket = true;

    try {
        latestQuotes = await getQuotes(WATCHLIST);

        const insights = generateInsights(latestQuotes);

        renderWatchlist(latestQuotes);
        renderPortfolioSummary(latestQuotes);
        renderHoldings(latestQuotes);
        renderTransactions();
        renderInsightSummary(insights);
        renderInsights(insights);
    } catch (error) {
        console.error("Failed to load market data:", error);
        alert("Unable to refresh market data right now. Please try again shortly.");
    } finally {
        isLoadingMarket = false;
    }
}


/**
 * =========================================
 * USER ACTION HANDLERS
 * =========================================
 * Handles buy/sell actions and updates all
 * portfolio-related UI components.
 *
 * These handlers reuse the existing latestQuotes
 * cache instead of making another API request.
 * That keeps trades responsive and avoids
 * unnecessary additional market calls.
 */

/**
 * Buys 1 unit of the selected stock using the latest
 * displayed market price, then rerenders all portfolio
 * and insight sections.
 */
function handleBuy(symbol, price) {
    buyStock(symbol, price);

    const insights = generateInsights(latestQuotes);

    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
    renderInsightSummary(insights);
    renderInsights(insights);
}

/**
 * Sells 1 unit of the selected stock using the latest
 * displayed market price, then rerenders all portfolio
 * and insight sections.
 */
function handleSell(symbol, price) {
    sellStock(symbol, price);

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
 */
function startMarketAutoRefresh() {
    if (marketRefreshTimer !== null) {
        return;
    }

    marketRefreshTimer = setInterval(loadMarket, REFRESH_INTERVAL_MS);
}

/**
 * Stops automatic market refreshing if a timer is active.
 * Not required for basic 2.1 behaviour, but useful for
 * future upgrades such as pause/resume controls.
 */
function stopMarketAutoRefresh() {
    if (marketRefreshTimer === null) {
        return;
    }

    clearInterval(marketRefreshTimer);
    marketRefreshTimer = null;
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
 *   button state immediately, and trigger a market refresh.
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

    await loadMarket();
}


/**
 * =========================================
 * INITIALISATION
 * =========================================
 * Initial page setup:
 * - bind the manual refresh button
 * - load market data immediately
 * - start timed auto-refresh
 * - keep button cooldown text updated
 */

// Bind manual refresh button if it exists
document.getElementById("refresh-btn")?.addEventListener("click", handleManualRefresh);

// Load market data immediately on page load
loadMarket();

// Start automatic timed refresh cycle
startMarketAutoRefresh();

// Update the button label every second so the cooldown
// countdown stays visually accurate for the user
setInterval(updateRefreshButtonState, 1000);

// Set the initial button state on first load
updateRefreshButtonState();