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
 * Fetches market data and updates:
 * - watchlist
 * - portfolio summary
 * - holdings
 * - transactions
 */
async function loadMarket() {
    latestQuotes = await getQuotes(WATCHLIST);

    renderWatchlist(latestQuotes);
    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
}


/**
 * =========================================
 * USER ACTION HANDLERS
 * =========================================
 * Handles buy/sell interactions and refreshes portfolio UI.
 */
function handleBuy(symbol, price) {
    buyStock(symbol, price);

    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
}

function handleSell(symbol, price) {
    sellStock(symbol, price);

    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
}


/**
 * =========================================
 * INITIALISATION
 * =========================================
 * Sets up event listeners and loads initial data.
 */
document.getElementById("refresh-btn").addEventListener("click", loadMarket);

loadMarket();