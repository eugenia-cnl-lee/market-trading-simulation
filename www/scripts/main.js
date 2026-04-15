/**
 * =========================================
 * WATCHLIST CONFIGURATION
 * =========================================
 * Defines which stocks are shown in the market view.
 */
const WATCHLIST = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"];

/**
 * Stores latest fetched market data for reuse
 * across UI updates (portfolio calculations, etc.)
 */
let latestQuotes = {};


/**
 * =========================================
 * MARKET LOADING
 * =========================================
 * Fetches market data, generates portfolio insights,
 * and updates all major interface sections including:
 * - market watchlist
 * - portfolio summary, holdings, and transactions
 * - insight summary and detailed insight cards
 *
 * Ensures a single source of truth by generating insights once
 * and reusing them across multiple UI components.
 */
async function loadMarket() {
    latestQuotes = await getQuotes(WATCHLIST);

    const insights = generateInsights(latestQuotes);

    renderWatchlist(latestQuotes);
    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
    renderInsightSummary(insights);
    renderInsights(insights);
}


/**
 * =========================================
 * USER ACTION HANDLERS
 * =========================================
 * Handles buy/sell actions and updates all
 * portfolio-related UI components.
 *
 * After each transaction:
 * - portfolio state is updated
 * - insights are regenerated based on new state
 * - UI is refreshed (summary, holdings, transactions, insights)
 *
 * Reuses existing market data (latestQuotes) to avoid
 * unnecessary API calls.
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
 * INITIALISATION
 * =========================================
 */
document.getElementById("refresh-btn").addEventListener("click", loadMarket);

loadMarket();