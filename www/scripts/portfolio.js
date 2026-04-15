/**
 * =========================================
 * PORTFOLIO STATE
 * =========================================
 * Stores all user financial data:
 * - cash balance
 * - holdings (per stock)
 * - transaction history
 */
const portfolio = {
    cash: 10000,
    holdings: {},
    transactions: []
};


/**
 * =========================================
 * BUY STOCK LOGIC
 * =========================================
 * Handles purchasing 1 unit of a stock.
 * Updates:
 * - cash balance
 * - holdings (quantity + average price)
 * - transaction history
 */
function buyStock(symbol, price) {
    if (portfolio.cash < price) {
        alert("Not enough cash");
        return;
    }

    // Deduct cash
    portfolio.cash -= price;

    // Initialise holding if not present
    if (!portfolio.holdings[symbol]) {
        portfolio.holdings[symbol] = {
            quantity: 0,
            avgPrice: 0
        };
    }

    const holding = portfolio.holdings[symbol];

    // Recalculate weighted average cost
    const totalCost = holding.avgPrice * holding.quantity + price;
    holding.quantity += 1;
    holding.avgPrice = totalCost / holding.quantity;

    // Record transaction
    portfolio.transactions.push({
        type: "BUY",
        symbol: symbol,
        price: price,
        time: new Date().toLocaleString()
    });
}


/**
 * =========================================
 * SELL STOCK LOGIC
 * =========================================
 * Handles selling 1 unit of a stock.
 * Updates:
 * - cash balance
 * - holdings
 * - transaction history
 */
function sellStock(symbol, price) {
    const holding = portfolio.holdings[symbol];

    if (!holding || holding.quantity === 0) {
        alert("No shares to sell");
        return;
    }

    // Add cash from sale
    portfolio.cash += price;

    // Reduce holding quantity
    holding.quantity -= 1;

    // Record transaction
    portfolio.transactions.push({
        type: "SELL",
        symbol: symbol,
        price: price,
        time: new Date().toLocaleString()
    });

    // Remove stock if no shares left
    if (holding.quantity === 0) {
        delete portfolio.holdings[symbol];
    }
}


/**
 * =========================================
 * PORTFOLIO CALCULATIONS
 * =========================================
 * Utility functions to compute:
 * - total value of holdings
 * - total portfolio value (cash + holdings)
 */

function calculateHoldingsValue(quotes) {
    let total = 0;

    for (const symbol in portfolio.holdings) {
        const holding = portfolio.holdings[symbol];
        const currentPrice = quotes[symbol]?.c || 0;
        total += holding.quantity * currentPrice;
    }

    return total;
}

function calculateTotalPortfolioValue(quotes) {
    return portfolio.cash + calculateHoldingsValue(quotes);
}