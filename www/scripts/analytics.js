/**
 * analytics.js
 *
 * Interpretation and feedback layer for the trading simulation.
 *
 * Owns:
 * - Analysis of portfolio structure and trading behaviour
 * - Generation of insights (e.g. concentration, diversification, performance interpretation)
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
 * 
 * This module consumes processed portfolio and market metrics
 * without owning the underlying accounting model.
 */


/**
 * =========================================
 * PORTFOLIO INSIGHT GENERATION
 * =========================================
 * Interprets portfolio state using processed quote data
 * and derived portfolio metrics.
 *
 * This function:
 * - computes reusable analysis data
 * - stores that data in a structured object
 * - generates user-facing insights from stored values
 *
 * Design Note:
 * Financial values are derived by the portfolio layer.
 * This function focuses on interpretation and feedback.
 */
function generateInsights(quotes) {
    const insights = [];
    const holdingSymbols = Object.keys(portfolio.holdings);
    const portfolioMetrics = getPortfolioMetrics(quotes);
    const totalValue = portfolioMetrics.totalPortfolioValue;

    const analysisData = {
        diversification: {
            holdingCount: holdingSymbols.length,
            state: "none"
        },
        allocation: {
            positions: [],
            sortedPositions: [],
            concentration: {
                top1Weight: 0,
                top3Weight: 0
            },
            sectorWeights: {},
            styleWeights: {},
            dominantSector: null,
            dominantSectorWeight: 0,
            dominantStyle: null,
            dominantStyleWeight: 0
        },
        tradingActivity: {
            transactionCount: 0,
            activityLevel: "none"
        },
        tradingPattern: {
            buyCount: 0,
            sellCount: 0,
            netBias: "neutral"
        },
        performance: {
            totalUnrealisedPnL: portfolioMetrics.unrealisedPnL,
            state: "breakeven"
        },
        cashPosition: {
            cashRatio: 0,
            state: "balanced"
        },
        dataReliability: {
            staleCount: 0,
            invalidCount: 0,
            usableHoldingCount: 0
        }
    };

    /**
     * -----------------------------------------
     * BASIC PORTFOLIO STRUCTURE
     * -----------------------------------------
     * Captures the simplest portfolio state based on
     * whether the user holds zero, one, or multiple positions.
     */
    if (analysisData.diversification.holdingCount === 0) {
        analysisData.diversification.state = "empty";

        insights.push({
            type: "info",
            title: "No Holdings",
            message: "You do not currently hold any stocks."
        });
    } else if (analysisData.diversification.holdingCount === 1) {
        analysisData.diversification.state = "single-position";

        insights.push({
            type: "warning",
            title: "Low Diversification",
            message: "Your portfolio is concentrated in a single stock, which increases risk."
        });
    } else {
        analysisData.diversification.state = "multi-position";
    }

    /**
     * -----------------------------------------
     * POSITION ALLOCATION
     * -----------------------------------------
     * Computes reusable position-level allocation data:
     * - market-value-backed positions
     * - position weights
     * - top-position concentration
     *
     * This data supports both insights and charts.
     */
    analysisData.allocation.positions = holdingSymbols
        .map(symbol => getHoldingPerformance(symbol, quotes[symbol]))
        .filter(position => position && position.marketValue !== null)
        .map(position => ({
            ...position,
            weight: totalValue > 0
                ? (position.marketValue / totalValue) * 100
                : 0
        }));

    analysisData.allocation.sortedPositions = [
        ...analysisData.allocation.positions
    ].sort((a, b) => b.weight - a.weight);

    analysisData.allocation.concentration.top1Weight =
        analysisData.allocation.sortedPositions[0]?.weight || 0;

    analysisData.allocation.concentration.top3Weight =
        analysisData.allocation.sortedPositions
            .slice(0, 3)
            .reduce((sum, position) => sum + position.weight, 0);

    if (analysisData.diversification.holdingCount >= 2) {
        if (analysisData.allocation.concentration.top1Weight >= 50) {
            insights.push({
                type: "warning",
                title: "High Concentration",
                message: "A single position makes up more than half of your portfolio."
            });
        } else if (analysisData.allocation.concentration.top3Weight >= 70) {
            insights.push({
                type: "warning",
                title: "Top-Heavy Portfolio",
                message: "A small number of positions dominate your portfolio."
            });
        } else if (analysisData.diversification.holdingCount >= 3) {
            insights.push({
                type: "positive",
                title: "Balanced Allocation",
                message: "Your capital is reasonably distributed across multiple positions."
            });
        }
    }

    /**
     * -----------------------------------------
     * GROUPED ALLOCATION EXPOSURE
     * -----------------------------------------
     * Aggregates position weights into broader categories:
     * - sector exposure
     * - style exposure
     *
     * Also identifies the dominant sector and style.
     */
    for (const position of analysisData.allocation.positions) {
        const sector = position.sector || "Other"; 
        const style = position.style || "Unknown";

        // Aggregate into sectorWeights
        analysisData.allocation.sectorWeights[sector] =
            (analysisData.allocation.sectorWeights[sector] || 0) + position.weight;

        // Aggregate into styleWeights
        analysisData.allocation.styleWeights[style] =
            (analysisData.allocation.styleWeights[style] || 0) + position.weight;
    }

    // Find dominant sector
    for (const sector in analysisData.allocation.sectorWeights) {
        const weight = analysisData.allocation.sectorWeights[sector];

        if (weight > analysisData.allocation.dominantSectorWeight) {
            analysisData.allocation.dominantSector = sector;
            analysisData.allocation.dominantSectorWeight = weight;
        }
    }

    // Find dominant style
    for (const style in analysisData.allocation.styleWeights) {
        const weight = analysisData.allocation.styleWeights[style];

        if (weight > analysisData.allocation.dominantStyleWeight) {
            analysisData.allocation.dominantStyle = style;
            analysisData.allocation.dominantStyleWeight = weight;
        }
    }

    // Insights
    if (analysisData.allocation.dominantSectorWeight >= 60) {
        insights.push({
            type: "warning",
            title: "Sector Concentration",
            message: `Your portfolio is heavily exposed to ${analysisData.allocation.dominantSector}.`
        });
    }

    if (analysisData.allocation.dominantStyleWeight >= 60) {
        insights.push({
            type: "info",
            title: "Portfolio Bias",
            message: `Your portfolio is strongly tilted towards ${analysisData.allocation.dominantStyle} stocks.`
        });
    }

    /**
     * -----------------------------------------
     * TRADING ACTIVITY
     * -----------------------------------------
     * Measures how active the user has been overall.
     */
    analysisData.tradingActivity.transactionCount = portfolio.transactions.length;

    if (analysisData.tradingActivity.transactionCount === 0) {
        analysisData.tradingActivity.activityLevel = "none";

        insights.push({
            type: "info",
            title: "No Trading Activity",
            message: "You have not made any trades yet."
        });
    } else if (analysisData.tradingActivity.transactionCount <= 3) {
        analysisData.tradingActivity.activityLevel = "low";

        insights.push({
            type: "info",
            title: "Trading Activity",
            message: "Your trading activity is still relatively low."
        });
    } else if (analysisData.tradingActivity.transactionCount <= 7) {
        analysisData.tradingActivity.activityLevel = "moderate";

        insights.push({
            type: "positive",
            title: "Active Portfolio Building",
            message: "You are actively building your portfolio."
        });
    } else {
        analysisData.tradingActivity.activityLevel = "high";

        insights.push({
            type: "warning",
            title: "Frequent Trading",
            message: "You have traded frequently, which may increase decision risk."
        });
    }

    /**
     * -----------------------------------------
     * BUY / SELL PATTERN
     * -----------------------------------------
     * Tracks whether recent behaviour is more buy-heavy
     * or sell-heavy.
     */
    for (const transaction of portfolio.transactions) {
        if (transaction.type === "BUY") {
            analysisData.tradingPattern.buyCount += 1;
        } else if (transaction.type === "SELL") {
            analysisData.tradingPattern.sellCount += 1;
        }
    }

    if (analysisData.tradingPattern.buyCount > analysisData.tradingPattern.sellCount) {
        analysisData.tradingPattern.netBias = "buying";

        insights.push({
            type: "info",
            title: "Trading Pattern",
            message: "Your recent behaviour is more accumulation-focused than selling-focused."
        });
    } else if (analysisData.tradingPattern.sellCount > analysisData.tradingPattern.buyCount) {
        analysisData.tradingPattern.netBias = "selling";

        insights.push({
            type: "info",
            title: "Trading Pattern",
            message: "You have been selling more actively than buying."
        });
    } else {
        analysisData.tradingPattern.netBias = "balanced";
    }

    /**
     * -----------------------------------------
     * PORTFOLIO PERFORMANCE
     * -----------------------------------------
     * Interprets unrealised portfolio performance using
     * the centralised portfolio metrics.
     */
    if (holdingSymbols.length > 0) {
        if (analysisData.performance.totalUnrealisedPnL > 0) {
            analysisData.performance.state = "profit";

            insights.push({
                type: "positive",
                title: "Current Performance",
                message: "Your current holdings are profitable overall."
            });
        } else if (analysisData.performance.totalUnrealisedPnL < 0) {
            analysisData.performance.state = "loss";

            insights.push({
                type: "warning",
                title: "Current Performance",
                message: "Your current holdings are currently at an unrealised loss overall."
            });
        } else {
            analysisData.performance.state = "breakeven";

            insights.push({
                type: "info",
                title: "Current Performance",
                message: "Your current holdings are roughly breakeven overall."
            });
        }
    }

    /**
     * -----------------------------------------
     * CASH POSITION
     * -----------------------------------------
     * Measures how much of the total portfolio remains
     * in cash rather than invested.
     */
    if (totalValue > 0) {
        analysisData.cashPosition.cashRatio = portfolio.cash / totalValue;

        if (analysisData.cashPosition.cashRatio >= 0.7) {
            analysisData.cashPosition.state = "cash-heavy";

            insights.push({
                type: "info",
                title: "Cash Position",
                message: "A large portion of your portfolio remains in cash."
            });
        } else if (analysisData.cashPosition.cashRatio <= 0.2) {
            analysisData.cashPosition.state = "mostly-invested";

            insights.push({
                type: "info",
                title: "Cash Position",
                message: "Most of your portfolio is currently invested rather than held in cash."
            });
        } else {
            analysisData.cashPosition.state = "balanced";
        }
    }

    /**
     * -----------------------------------------
     * DATA RELIABILITY
     * -----------------------------------------
     * Tracks whether holdings are being analysed using
     * live, stale, or unavailable market data.
     */
    for (const symbol of holdingSymbols) {
        const quote = quotes[symbol];

        if (!quote) {
            analysisData.dataReliability.invalidCount += 1;
            continue;
        }

        if (quote.isStale) {
            analysisData.dataReliability.staleCount += 1;
            analysisData.dataReliability.usableHoldingCount += 1;
            continue;
        }

        if (!quote.isValid) {
            analysisData.dataReliability.invalidCount += 1;
            continue;
        }

        analysisData.dataReliability.usableHoldingCount += 1;
    }

    if (analysisData.dataReliability.invalidCount > 0) {
        insights.push({
            type: "warning",
            title: "Market Data Unavailable",
            message: "Some holdings could not be updated with valid market data."
        });
    } else if (analysisData.dataReliability.staleCount > 0) {
        insights.push({
            type: "info",
            title: "Stale Market Data",
            message: "Some holdings are using previously known prices due to delayed updates."
        });
    }

    return {
        insights,
        allocationData: {
            positions: analysisData.allocation.positions,

            sorted: analysisData.allocation.sortedPositions,

            sector: analysisData.allocation.sectorWeights,
            style: analysisData.allocation.styleWeights,

            concentration: {
                top1: analysisData.allocation.concentration.top1Weight,
                top3: analysisData.allocation.concentration.top3Weight
            },

            dominantSector: analysisData.allocation.dominantSector,
            dominantSectorWeight: analysisData.allocation.dominantSectorWeight,

            dominantStyle: analysisData.allocation.dominantStyle,
            dominantStyleWeight: analysisData.allocation.dominantStyleWeight
        }
    };
}