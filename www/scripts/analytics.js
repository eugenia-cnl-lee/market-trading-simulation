/**
 * analytics.js
 *
 * Interpretation and feedback layer for the trading simulation.
 *
 * Owns:
 * - Analysis of portfolio structure and trading behaviour
 * - Generation of insights (e.g. concentration, diversification)
 * - User-facing feedback and decision support
 *
 * Does not own:
 * - Core portfolio state
 * - Market data fetching
 * - UI rendering
 *
 * Design Note:
 * This module adds an interpretive layer on top of processed
 * portfolio and market state, differentiating the project by
 * providing meaningful insights rather than acting as a simple tracker.
 */


/**
 * =========================================
 * PORTFOLIO INSIGHT GENERATION
 * =========================================
 * Analyses the portfolio and returns structured
 * insight objects for rendering.
 *
 * Behaviour:
 * - Uses processed quote data from the shared market state
 * - Ignores invalid or unavailable quotes
 * - Supports stale quotes (fallback values)
 * - Avoids generating misleading insights when data is incomplete
 *
 * This ensures insights remain meaningful even when
 * market data is partially unavailable or delayed.
 *
 * Design Note:
 * This module assumes all quote data has already been
 * validated and normalised. It focuses only on interpreting
 * usable data, maintaining a clear separation between
 * data reliability handling and analytical logic.
 */
function generateInsights(quotes) {
    const insights = [];

    const holdingSymbols = Object.keys(portfolio.holdings);
    const holdingsValue = calculateHoldingsValue(quotes);
    const totalValue = calculateTotalPortfolioValue(quotes);

    /**
     * Determines whether a quote can be safely used for
     * analytical calculations.
     *
     * Usable quotes include:
     * - live valid quotes
     * - stale fallback quotes
     *
     * Unavailable or invalid quotes are excluded to avoid
     * generating misleading portfolio insights.
     */
    function isUsableQuote(quote) {
        return quote && (quote.isValid || quote.isStale);
    }

    /**
     * -----------------------------------------
     * DIVERSIFICATION / CONCENTRATION ANALYSIS
     * -----------------------------------------
     */
    if (holdingSymbols.length === 0) {
        insights.push({
            type: "info",
            title: "No Holdings",
            message: "You do not currently hold any stocks."
        });
    } else if (holdingSymbols.length === 1) {
        insights.push({
            type: "warning",
            title: "Low Diversification",
            message: "Your portfolio is concentrated in a single stock, which increases risk."
        });
    } else if (holdingSymbols.length >= 3) {
        insights.push({
            type: "positive",
            title: "Diversification",
            message: "Your portfolio is spread across multiple stocks, which improves diversification."
        });
    }

    let largestHoldingSymbol = null;
    let largestHoldingValue = 0;

    for (const symbol of holdingSymbols) {
        const holding = portfolio.holdings[symbol];
        const quote = quotes[symbol];

        if (!isUsableQuote(quote)) {
            continue;
        }

        const currentPrice = quote.price;
        const marketValue = holding.quantity * currentPrice;

        if (marketValue > largestHoldingValue) {
            largestHoldingValue = marketValue;
            largestHoldingSymbol = symbol;
        }
    }

    if (largestHoldingSymbol && holdingsValue > 0) {
        const concentrationRatio = largestHoldingValue / holdingsValue;

        if (concentrationRatio >= 0.7) {
            insights.push({
                type: "warning",
                title: "High Concentration",
                message: `Your portfolio is highly concentrated in ${largestHoldingSymbol}.`
            });
        } else if (concentrationRatio >= 0.4) {
            insights.push({
                type: "info",
                title: "Largest Position",
                message: `${largestHoldingSymbol} is currently your largest position.`
            });
        }
    }

    /**
     * -----------------------------------------
     * TRADING ACTIVITY ANALYSIS
     * -----------------------------------------
     */
    const transactionCount = portfolio.transactions.length;

    if (transactionCount === 0) {
        insights.push({
            type: "info",
            title: "No Trading Activity",
            message: "You have not made any trades yet."
        });
    } else if (transactionCount >= 1 && transactionCount <= 3) {
        insights.push({
            type: "info",
            title: "Trading Activity",
            message: "Your trading activity is still relatively low."
        });
    } else if (transactionCount >= 4 && transactionCount <= 7) {
        insights.push({
            type: "positive",
            title: "Active Portfolio Building",
            message: "You are actively building your portfolio."
        });
    } else {
        insights.push({
            type: "warning",
            title: "Frequent Trading",
            message: "You have traded frequently, which may increase decision risk."
        });
    }

    /**
     * -----------------------------------------
     * BUY / SELL BEHAVIOUR ANALYSIS
     * -----------------------------------------
     */
    let buyCount = 0;
    let sellCount = 0;

    for (const transaction of portfolio.transactions) {
        if (transaction.type === "BUY") {
            buyCount += 1;
        } else if (transaction.type === "SELL") {
            sellCount += 1;
        }
    }

    if (buyCount > sellCount) {
        insights.push({
            type: "info",
            title: "Trading Pattern",
            message: "Your recent behaviour is more accumulation-focused than selling-focused."
        });
    } else if (sellCount > buyCount) {
        insights.push({
            type: "info",
            title: "Trading Pattern",
            message: "You have been selling more actively than buying."
        });
    }

    /**
     * -----------------------------------------
     * PORTFOLIO PERFORMANCE ANALYSIS
     * -----------------------------------------
     * Evaluates overall unrealised portfolio performance
     * using only usable quote data.
     *
     * Invalid or unavailable quotes are excluded so
     * performance insights are not based on missing data.
     */
    let totalUnrealisedPnL = 0;

        for (const symbol of holdingSymbols) {
            const holding = portfolio.holdings[symbol];
            const quote = quotes[symbol];

            if (!isUsableQuote(quote)) {
                continue;
            }

            const currentPrice = quote.price;
            totalUnrealisedPnL += (currentPrice - holding.avgPrice) * holding.quantity;
        }

    if (holdingSymbols.length > 0) {
        if (totalUnrealisedPnL > 0) {
            insights.push({
                type: "positive",
                title: "Current Performance",
                message: "Your current holdings are profitable overall."
            });
        } else if (totalUnrealisedPnL < 0) {
            insights.push({
                type: "warning",
                title: "Current Performance",
                message: "Your current holdings are currently at an unrealised loss overall."
            });
        } else {
            insights.push({
                type: "info",
                title: "Current Performance",
                message: "Your current holdings are roughly breakeven overall."
            });
        }
    }

    /**
     * -----------------------------------------
     * CASH POSITION ANALYSIS
     * -----------------------------------------
     */
    if (totalValue > 0) {
        const cashRatio = portfolio.cash / totalValue;

        if (cashRatio >= 0.7) {
            insights.push({
                type: "info",
                title: "Cash Position",
                message: "A large portion of your portfolio remains in cash."
            });
        } else if (cashRatio <= 0.2) {
            insights.push({
                type: "info",
                title: "Cash Position",
                message: "Most of your portfolio is currently invested rather than held in cash."
            });
        }
    }

    /**
     * -----------------------------------------
     * DATA RELIABILITY ANALYSIS
     * -----------------------------------------
     * Adds insight feedback when holdings are being valued
     * using stale fallback data or when valid quote data
     * is unavailable.
     *
     * This helps the user interpret portfolio insights
     * in the context of market data quality.
     */
    let staleCount = 0;
    let invalidCount = 0;

    for (const symbol of holdingSymbols) {
        const quote = quotes[symbol];
        if (!quote) {
            invalidCount += 1;
            continue;
        }
        if (quote.isStale) {
            staleCount += 1;
            continue;
        }
        if (!quote.isValid) {
            invalidCount += 1;
        }
    }

    if (invalidCount > 0) {
        insights.push({
            type: "warning",
            title: "Market Data Unavailable",
            message: "Some holdings could not be updated with valid market data."
        });
    } else if (staleCount > 0) {
        insights.push({
            type: "info",
            title: "Stale Market Data",
            message: "Some holdings are using previously known prices due to delayed updates."
        });
    }

    return insights;
}