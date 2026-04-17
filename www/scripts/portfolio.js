/**
 * portfolio.js
 *
 * Core paper trading and portfolio management module.
 *
 * Owns:
 * - Portfolio state (cash, holdings, transactions, realised PnL)
 * - Buy and sell operations with execution validation
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
const PORTFOLIO_STORAGE_KEY = "marketTradingPortfolio";

const DEFAULT_PORTFOLIO_STATE = {
    cash: 10000,
    holdings: {},
    transactions: [],
    realisedPnL: 0
};

const portfolio = loadPortfolioState();

/**
 * Loads persisted portfolio state from localStorage.
 *
 * Falls back to the default paper-trading portfolio
 * when no saved state exists or stored data is invalid.
 */
function loadPortfolioState() {
    try {
        const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);

        if (!raw) {
            return { ...DEFAULT_PORTFOLIO_STATE };
        }

        const parsed = JSON.parse(raw);

        return {
            cash: typeof parsed.cash === "number" ? parsed.cash : DEFAULT_PORTFOLIO_STATE.cash,
            holdings: parsed.holdings && typeof parsed.holdings === "object" ? parsed.holdings : {},
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            realisedPnL: typeof parsed.realisedPnL === "number" ? parsed.realisedPnL : 0
        };
    } catch (error) {
        console.error("Failed to load portfolio from localStorage:", error);
        return { ...DEFAULT_PORTFOLIO_STATE };
    }
}

/**
 * Saves the current portfolio state so it persists
 * across page navigation and reloads.
 */
function savePortfolioState() {
    try {
        localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolio));
    } catch (error) {
        console.error("Failed to save portfolio to localStorage:", error);
    }
}


/**
 * =========================================
 * EXECUTION REALISM LAYER
 * =========================================
 * Adds:
 * - market session validation
 * - quote validity / staleness checks
 * - deterministic slippage
 * - structured execution results
 *
 * Design Note:
 * This layer sits between user actions and portfolio updates,
 * ensuring trades reflect realistic constraints rather than
 * idealised instant execution.
 */

const SLIPPAGE_RATE = 0.001; // 0.1%

function validateTradeExecution(quote, marketSession) {
    if (!quote) {
        return { ok: false, reason: "No quote available" };
    }

    if (!quote.isValid) {
        return { ok: false, reason: "Invalid market data" };
    }

    if (quote.isStale) {
        return { ok: false, reason: "Quote is stale" };
    }

    if (!marketSession || marketSession.session !== "regular") {
        return { ok: false, reason: "Market is not open" };
    }

    return { ok: true };
}

function calculateExecutionPrice(price, type) {
    if (type === "BUY") {
        return price * (1 + SLIPPAGE_RATE);
    } else {
        return price * (1 - SLIPPAGE_RATE);
    }
}


/**
 * =========================================
 * BUY STOCK LOGIC
 * =========================================
 * Handles purchasing 1 unit of a stock through
 * the execution realism layer.
 *
 * Updates:
 * - validates quote reliability and market session
 * - applies deterministic slippage
 * - deducts cash using execution price
 * - holdings (quantity + weighted average cost)
 * - transaction history
 *
 * Design Note:
 * Buy orders no longer execute directly at the
 * displayed quote price. Instead, they pass through
 * a lightweight execution layer so portfolio state
 * reflects realistic trading constraints.
 */
function buyStock(symbol, quote, marketSession) {
    const validation = validateTradeExecution(quote, marketSession);

    if (!validation.ok) {
        return { success: false, message: validation.reason };
    }

    const executionPrice = calculateExecutionPrice(quote.price, "BUY");

    if (portfolio.cash < executionPrice) {
        return { success: false, message: "Not enough cash" };
    }

    portfolio.cash -= executionPrice;

    if (!portfolio.holdings[symbol]) {
        portfolio.holdings[symbol] = {
            quantity: 0,
            averageCost: 0
        };
    }

    const holding = portfolio.holdings[symbol];

    const totalCost = holding.averageCost * holding.quantity + executionPrice;
    holding.quantity += 1;
    holding.averageCost = totalCost / holding.quantity;

    portfolio.transactions.push({
        type: "BUY",
        symbol,
        displayedPrice: quote.price,
        executionPrice,
        slippage: SLIPPAGE_RATE,
        time: new Date().toLocaleString()
    });

    savePortfolioState();

    return {
        success: true,
        message: `Bought at $${executionPrice.toFixed(2)}`
    };
}

/**
 * =========================================
 * SELL STOCK LOGIC
 * =========================================
 * Handles selling 1 unit of a stock through
 * the execution realism layer.
 *
 * Updates:
 * - validates quote reliability and market session
 * - applies deterministic slippage
 * - cash balance using execution price
 * - holdings
 * - realised profit/loss
 * - transaction history
 *
 * Design Note:
 * Sell orders now execute using the effective
 * execution price rather than the displayed quote,
 * ensuring realised profit/loss reflects trading
 * friction instead of idealised fills.
 */
function sellStock(symbol, quote, marketSession) {
    const holding = portfolio.holdings[symbol];

    if (!holding || holding.quantity === 0) {
        return { success: false, message: "No shares to sell" };
    }

    const validation = validateTradeExecution(quote, marketSession);

    if (!validation.ok) {
        return { success: false, message: validation.reason };
    }

    const executionPrice = calculateExecutionPrice(quote.price, "SELL");

    portfolio.cash += executionPrice;

    const realised = executionPrice - holding.averageCost;
    portfolio.realisedPnL += realised;

    holding.quantity -= 1;

    portfolio.transactions.push({
        type: "SELL",
        symbol,
        displayedPrice: quote.price,
        executionPrice,
        slippage: SLIPPAGE_RATE,
        time: new Date().toLocaleString()
    });

    if (holding.quantity === 0) {
        delete portfolio.holdings[symbol];
    }

    savePortfolioState();

    return {
        success: true,
        message: `Sold at $${executionPrice.toFixed(2)}`
    };
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
    const meta = getStockMeta(symbol);
    const holding = portfolio.holdings[symbol];

    if (!holding) {
        return null;
    }

    const { quantity, averageCost } = holding;
    const costBasis = quantity * averageCost;

    const hasUsableQuote = quote && (quote.isValid || quote.isStale);

    // For invalid quote case
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
            isValid: false,
            sector: meta.sector,
            style: meta.style,
        };
    }

    // For normal qutoe case case
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
        isValid: quote.isValid,
        sector: meta.sector,
        style: meta.style
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


/**
 * =========================================
 * PORTFOLIO ALLOCATION ANALYTICS
 * =========================================
 * Computes:
 * - position weights
 * - sector allocation
 * - concentration metrics
 */

function getAllocationAnalytics(quotes) {
    const positions = [];
    let totalValue = portfolio.cash;

    // First pass: compute values
    for (const symbol in portfolio.holdings) {
        const perf = getHoldingPerformance(symbol, quotes[symbol]);

        if (!perf || perf.marketValue === null) continue;

        positions.push(perf);
        totalValue += perf.marketValue;
    }

    // Second pass: compute weights
    const weightedPositions = positions.map(p => ({
        ...p,
        weight: totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0
    }));

    // Sector allocation
    const sectorAllocation = {};

    for (const p of weightedPositions) {
        const sector = p.sector || "Other";

        if (!sectorAllocation[sector]) {
            sectorAllocation[sector] = 0;
        }

        sectorAllocation[sector] += p.weight;
    }

    // Sort largest positions
    const sorted = [...weightedPositions].sort((a, b) => b.weight - a.weight);

    const largest = sorted[0]?.weight || 0;
    const top3 = sorted.slice(0, 3).reduce((sum, p) => sum + p.weight, 0);

    return {
        positions: sorted,
        sectorAllocation,
        concentration: {
            largestPosition: largest,
            top3Total: top3
        }
    };
}