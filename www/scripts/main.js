const WATCHLIST = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"];

async function loadMarket() {
    const quotes = await getQuotes(WATCHLIST);
    renderWatchlist(quotes);
}

document.getElementById("refresh-btn").addEventListener("click", loadMarket);

loadMarket();