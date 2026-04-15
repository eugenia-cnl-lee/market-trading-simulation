function renderWatchlist(quotes) {
    const watchlist = document.getElementById("watchlist");
    watchlist.innerHTML = "";

    for (const symbol in quotes) {
        const data = quotes[symbol];

        const stockCard = document.createElement("div");
        stockCard.className = "stock-card";

        stockCard.innerHTML = `
            <h2 class="stock-symbol">${symbol}</h2>
            <p class="stock-price">Price: $${data.c.toFixed(2)}</p>
            <p class="stock-change">Change: ${data.d.toFixed(2)} (${data.dp.toFixed(2)}%)</p>
        
            <button class="buy-btn" onclick="handleBuy('${symbol}', ${data.c})">Buy</button>
            <button class="sell-btn" onclick="handleSell('${symbol}', ${data.c})">Sell</button>
            `;

        watchlist.appendChild(stockCard);
    }
}