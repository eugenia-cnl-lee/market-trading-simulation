const portfolio = {
    cash: 10000,
    holdings: {},
    transactions: []
};

// feature: BUY
function buyStock(symbol, price) {
    if (portfolio.cash < price) {
        alert("Not enough cash");
        return;
    }

    portfolio.cash -= price;

    if (!portfolio.holdings[symbol]) {
        portfolio.holdings[symbol] = {
            quantity: 0,
            avgPrice: 0
        };
    }

    const holding = portfolio.holdings[symbol];

    const totalCost = holding.avgPrice * holding.quantity + price;
    holding.quantity += 1;
    holding.avgPrice = totalCost / holding.quantity;

    portfolio.transactions.push({
        type: "BUY",
        symbol: symbol,
        price: price,
        time: new Date().toLocaleString()
    });
}

// feature: SELL
function sellStock(symbol, price) {
    const holding = portfolio.holdings[symbol];

    if (!holding || holding.quantity === 0) {
        alert("No shares to sell");
        return;
    }

    portfolio.cash += price;
    holding.quantity -= 1;

    portfolio.transactions.push({
        type: "SELL",
        symbol: symbol,
        price: price,
        time: new Date().toLocaleString()
    });
}