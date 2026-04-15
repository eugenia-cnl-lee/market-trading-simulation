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
 * Fetches market data and updates all major
 * interface sections.
 */
async function loadMarket() {
    latestQuotes = await getQuotes(WATCHLIST);

    renderWatchlist(latestQuotes);
    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
    renderInsights(generateInsights(latestQuotes));
}


/**
 * =========================================
 * USER ACTION HANDLERS
 * =========================================
 * Handles buy/sell actions and refreshes
 * portfolio-related UI.
 */
function handleBuy(symbol, price) {
    buyStock(symbol, price);

    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
    renderInsights(generateInsights(latestQuotes));
}

function handleSell(symbol, price) {
    sellStock(symbol, price);

    renderPortfolioSummary(latestQuotes);
    renderHoldings(latestQuotes);
    renderTransactions();
    renderInsights(generateInsights(latestQuotes));
}


/**
 * =========================================
 * INITIALISATION
 * =========================================
 */
document.getElementById("refresh-btn").addEventListener("click", loadMarket);

loadMarket();