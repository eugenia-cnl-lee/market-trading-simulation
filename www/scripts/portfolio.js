/**
 * portfolio.js
 *
 * Core paper trading and portfolio management module.
 *
 * Owns:
 * - Portfolio state (cash, holdings, transactions, realised PnL)
 * - Buy and sell operations
 * - Average cost and position tracking
 * - Holding-level accounting metrics
 * - Portfolio valuation and profit/loss calculations
 *
 * Does not own:
 * - Market data fetching
 * - UI rendering
 * - External data validation
 *
 * Design Note:
 * This module encapsulates trading logic and state,
 * ensuring that portfolio behaviour remains independent
 * from data sources and presentation layers.
 */


/**
 * =========================================
 * PORTFOLIO STATE
 * =========================================
 * Stores all user financial data:
 * - cash balance
 * - holdings (per stock)
 * - transaction history
 * - cumulative realised profit/loss
 */
const portfolio = {
    cash: 10000,
    holdings: {},
    transactions: [],
    realisedPnL: 0
};


/**
 * =========================================
 * BUY STOCK LOGIC
 * =========================================
 * Handles purchasing 1 unit of a stock.
 * Updates:
 * - cash balance
 * - holdings (quantity + weighted average cost)
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
            averageCost: 0
        };
    }

    const holding = portfolio.holdings[symbol];

    // Recalculate weighted average cost
    const totalCost = holding.averageCost * holding.quantity + price;
    holding.quantity += 1;
    holding.averageCost = totalCost / holding.quantity;

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
 * - realised profit/loss
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

    // Realise profit or loss against the holding's average cost
    const realised = price - holding.averageCost;
    portfolio.realisedPnL += realised;

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
 * PORTFOLIO ACCOUNTING AND VALUATION
 * =========================================
 * Utility functions to compute:
 * - holding-level accounting metrics
 * - holdings value and cost basis
 * - realised and unrealised profit/loss
 * - total portfolio value and return
 * - near-zero normalisation for stable financial output
 *
 * Design Note:
 * Market-dependent values are derived on demand from
 * portfolio state and processed quote data rather than
 * being permanently stored in holdings state.
 *
 * This keeps durable trading state separate from live
 * valuation data, while ensuring that the UI and analytics
 * layers consume a single consistent accounting model.
 */

/**
 * Normalises very small numeric values to zero so the system
 * does not display misleading values such as -0.00 caused by
 * floating-point precision or tiny market movements.
 *
 * Behaviour:
 * - Returns 0 when the absolute value is smaller than the threshold
 * - Otherwise returns the original value unchanged
 *
 * Design Note:
 * This keeps portfolio summaries and analytics aligned by
 * removing insignificant near-zero noise at the accounting layer
 * rather than handling it separately in the UI.
 */
function normaliseNearZero(value, threshold = 0.005) {
    return Math.abs(value) < threshold ? 0 : value;
}

/**
 * Computes derived accounting metrics for a single holding.
 *
 * Returns:
 * - quantity
 * - average cost
 * - cost basis
 * - current market price
 * - market value
 * - unrealised profit/loss
 * - unrealised return percentage
 * - quote validity and freshness state
 *
 * Behaviour:
 * - Uses processed quote data from the market layer
 * - Treats live and stale quotes as usable valuation inputs
 * - Avoids producing misleading market-based metrics
 *   when quote data is unavailable or invalid
 * - Normalises insignificant near-zero valuation values to avoid
 *   misleading outputs such as -0.00
 *
 * Design Note:
 * This function derives live valuation data from durable
 * portfolio state and processed market data, rather than
 * storing these values permanently in the holding itself.
 */
function getHoldingPerformance(symbol, quote) {
    const holding = portfolio.holdings[symbol];

    if (!holding) {
        return null;
    }

    const { quantity, averageCost } = holding;
    const costBasis = quantity * averageCost;

    const hasUsableQuote = quote && (quote.isValid || quote.isStale);

    if (!hasUsableQuote) {
        return {
            symbol,
            quantity,
            averageCost,
            costBasis,
            currentPrice: null,
            marketValue: null,
            unrealisedPnL: null,
            unrealisedPnLPercent: null,
            isStale: false,
            isValid: false
        };
    }

    const currentPrice = quote.price;
    const marketValue = quantity * currentPrice;
    const unrealisedPnL = normaliseNearZero(marketValue - costBasis);
    const unrealisedPnLPercent = costBasis > 0
        ? normaliseNearZero((unrealisedPnL / costBasis) * 100)
        : 0;

    return {
        symbol,
        quantity,
        averageCost,
        costBasis,
        currentPrice,
        marketValue,
        unrealisedPnL,
        unrealisedPnLPercent,
        isStale: quote.isStale,
        isValid: quote.isValid
    };
}

/**
 * Computes portfolio-level accounting and performance metrics
 * from the current portfolio state and processed quote data.
 *
 * Returns:
 * - cash balance
 * - total holdings value
 * - total portfolio value
 * - cumulative realised profit/loss
 * - total unrealised profit/loss
 * - overall return
 * - overall return percentage
 *
 * Behaviour:
 * - Aggregates holding-level performance across all positions
 * - Includes only holdings with usable quote data in
 *   market-dependent valuation totals
 * - Preserves realised profit/loss independently from
 *   live market fluctuations
 * - Normalises insignificant near-zero values so portfolio
 *   summaries and insights remain visually and semantically consistent
 *
 * Design Note:
 * This function acts as the main portfolio summary calculator,
 * allowing the UI and analytics layers to consume a consistent
 * portfolio snapshot without duplicating financial logic.
 */
function getPortfolioMetrics(quotes) {
    let holdingsValue = 0;
    let totalCostBasis = 0;
    let totalUnrealisedPnL = 0;

    for (const symbol in portfolio.holdings) {
        const performance = getHoldingPerformance(symbol, quotes[symbol]);

        totalCostBasis += performance.costBasis;

        if (performance.marketValue !== null) {
            holdingsValue += performance.marketValue;
            totalUnrealisedPnL += performance.unrealisedPnL;
        }
    }

    const totalPortfolioValue = portfolio.cash + holdingsValue;
    const totalReturn = normaliseNearZero(portfolio.realisedPnL + totalUnrealisedPnL);

    const totalReturnPercent = totalCostBasis > 0
        ? normaliseNearZero((totalReturn / totalCostBasis) * 100)
        : 0;

    return {
        cash: portfolio.cash,
        holdingsValue: normaliseNearZero(holdingsValue),
        totalPortfolioValue: normaliseNearZero(totalPortfolioValue),
        realisedPnL: normaliseNearZero(portfolio.realisedPnL),
        unrealisedPnL: normaliseNearZero(totalUnrealisedPnL),
        totalReturn,
        totalReturnPercent
    };
}