const WATCHLIST = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"];

async function loadMarket() {
    const quotes = await getQuotes(WATCHLIST);
    renderWatchlist(quotes);
}

document.getElementById("refresh-btn").addEventListener("click", loadMarket);

loadMarket();

function handleBuy(symbol, price) {
    buyStock(symbol, price);
    console.log(portfolio);
}

function handleSell(symbol, price) {
    sellStock(symbol, price);
    console.log(portfolio);
}