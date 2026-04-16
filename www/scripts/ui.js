/**
 * ui.js
 *
 * Presentation layer for the trading simulation dashboard.
 *
 * Owns:
 * - Rendering of market data, portfolio data, and analytics output
 * - DOM updates based on application state
 * - Visual feedback and user-facing status indicators
 *
 * Does not own:
 * - Market data fetching
 * - Portfolio calculations
 * - Application state management
 *
 * Design Note:
 * This module ensures a clear separation between how data is displayed
 * and how it is produced, supporting maintainability and scalability.
 */


/**
 * =========================================
 * WATCHLIST RENDERING
 * =========================================
 * Displays all stocks in the market watchlist.
 * Each stock includes:
 * - price
 * - change
 * - buy/sell actions
 * - quote status (live, stale, unavailable)
 *
 * Behaviour:
 * - Renders normalised quote data from the shared market state
 * - Displays fallback values when quotes are stale
 * - Handles unavailable or invalid quotes gracefully
 * - Applies visual indicators for price movement and quote status
 * - Differentiates between:
 *   - live quotes (fresh data)
 *   - stale quotes (fallback to previous data)
 *   - unavailable quotes (no valid data)
 *
 * This function assumes all quote data has already been:
 * - fetched
 * - normalised
 * - validated
 * by the market data layer.
 *
 * Design Note:
 * This function focuses purely on presentation, ensuring that
 * data reliability concerns (e.g. validation, fallback handling)
 * remain outside the UI layer. It communicates quote freshness
 * and availability to the user without altering the underlying data.
 * 
 * By separating data validation from rendering, this function
 * ensures that the UI remains predictable and consistent,
 * even when underlying market data is incomplete or delayed.
 */
function renderWatchlist(quotes) {
    const watchlist = document.getElementById("watchlist");

    if (!watchlist) {
        console.error("Missing element: #watchlist");
        return;
    }

    watchlist.innerHTML = "";

    for (const symbol in quotes) {
        const data = quotes[symbol];

        const stockCard = document.createElement("div");
        stockCard.className = "stock-card";

        const priceText = data.isValid || data.isStale
            ? `$${data.price.toFixed(2)}`
            : "Unavailable";

        const changeText = data.isValid || data.isStale
            ? `${data.change.toFixed(2)} (${data.changePercent.toFixed(2)}%)`
            : "Unavailable";

        const quoteStateText = !data.isValid
            ? "Unavailable"
            : data.isStale
                ? "Stale"
                : "Live";

        stockCard.innerHTML = `
            <h2 class="stock-symbol">${symbol}</h2>
            <p class="stock-price">Price: ${priceText}</p>
            <p class="stock-change">Change: ${changeText}</p>
            <p class="stock-state">Status: ${quoteStateText}</p>

            <button class="buy-btn" onclick="handleBuy('${symbol}', ${data.price})" ${!data.isValid && !data.isStale ? "disabled" : ""}>Buy</button>
            <button class="sell-btn" onclick="handleSell('${symbol}', ${data.price})" ${!data.isValid && !data.isStale ? "disabled" : ""}>Sell</button>
        `;

        const changeElement = stockCard.querySelector(".stock-change");

        if (data.isValid || data.isStale) {
            if (data.change < 0) {
                changeElement.classList.add("negative");
            } else {
                changeElement.classList.add("positive");
            }
        }

        if (data.isStale) {
            stockCard.classList.add("stale-quote");
        }

        if (!data.isValid && !data.isStale) {
            stockCard.classList.add("invalid-quote");
        }

        watchlist.appendChild(stockCard);
    }
}


/**
 * =========================================
 * PORTFOLIO SUMMARY RENDERING
 * =========================================
 * Displays:
 * - cash balance
 * - holdings value
 * - total portfolio value
 */
function renderPortfolioSummary(quotes) {
    const summary = document.getElementById("portfolio-summary");

    // Logging for debugging purposes
    if (!summary) {
        console.error('Missing element: #portfolio-summary');
        return;
    }

    const holdingsValue = calculateHoldingsValue(quotes);
    const totalValue = calculateTotalPortfolioValue(quotes);

    summary.innerHTML = `
        <p><strong>Cash:</strong> $${portfolio.cash.toFixed(2)}</p>
        <p><strong>Holdings Value:</strong> $${holdingsValue.toFixed(2)}</p>
        <p><strong>Total Portfolio Value:</strong> $${totalValue.toFixed(2)}</p>
    `;
}


/**
 * =========================================
 * HOLDINGS RENDERING
 * =========================================
 * Displays each stock owned:
 * - quantity
 * - average price
 * - current price
 * - market value
 * - unrealised PnL
 */
function renderHoldings(quotes) {
    const holdingsContainer = document.getElementById("holdings");

    // Logging for debugging purposes
    if (!holdingsContainer) {
        console.error('Missing element: #holdings');
        return;
    }

    holdingsContainer.innerHTML = "";

    const symbols = Object.keys(portfolio.holdings);

    if (symbols.length === 0) {
        holdingsContainer.innerHTML = "<p>No holdings yet.</p>";
        return;
    }

    for (const symbol of symbols) {
        const holding = portfolio.holdings[symbol];
        const currentPrice = quotes[symbol]?.price || 0;
        const marketValue = holding.quantity * currentPrice;
        const unrealisedPnL = (currentPrice - holding.avgPrice) * holding.quantity;

        const holdingCard = document.createElement("div");
        holdingCard.className = "holding-card";

        holdingCard.innerHTML = `
            <p><strong>${symbol}</strong></p>
            <p>Quantity: ${holding.quantity}</p>
            <p>Average Cost: $${holding.avgPrice.toFixed(2)}</p>
            <p>Current Price: $${currentPrice.toFixed(2)}</p>
            <p>Market Value: $${marketValue.toFixed(2)}</p>
            <p class="holding-pnl ${unrealisedPnL < 0 ? "negative" : "positive"}">
                Unrealised PnL: $${unrealisedPnL.toFixed(2)}
            </p>
        `;

        holdingsContainer.appendChild(holdingCard);
    }
}


/**
 * =========================================
 * MARKET STATUS RENDERING
 * =========================================
 * Renders the current market update status,
 * including system state and data freshness.
 *
 * Supported states:
 * - loading → refresh in progress
 * - success → all quotes updated successfully
 * - partial → some quotes updated, others marked as stale
 * - error   → no valid quotes available
 * - idle    → no data loaded yet
 *
 * The UI communicates both data freshness and system behaviour,
 * allowing users to understand whether displayed values are live,
 * partially stale, or outdated.
 *
 * Design Note:
 * This function renders system state derived from the market
 * update pipeline, communicating data reliability without
 * modifying underlying application logic.
 */
function renderMarketStatus() {
    const statusElement = document.getElementById("market-status");

    if (!statusElement) {
        return;
    }

    // Loading state
    if (marketStatusType === "loading") {
        statusElement.textContent =
            `Updating market data... Auto-updating every ${REFRESH_INTERVAL_MS / 1000} seconds.`;
        return;
    }

    // Partial success state
    if (marketStatusType === "partial") {
        if (lastUpdatedTime) {
            const absolute = formatStatusDateTime(lastUpdatedTime);
            const relative = getRelativeTimeString(lastUpdatedTime);

            statusElement.innerHTML =
                `Market partially updated. Some quotes may be stale.<br>
            Last successful update: ${absolute} (${relative}) · Auto-updating every ${REFRESH_INTERVAL_MS / 1000} seconds.`;
        } else {
            statusElement.innerHTML =
                `Market partially updated. Some quotes may be stale.<br>
            Auto-updating every ${REFRESH_INTERVAL_MS / 1000} seconds.`;
        }
        return;
    }

    // Error state
    if (marketStatusType === "error") {
        if (lastUpdatedTime) {
            const absolute = formatStatusDateTime(lastUpdatedTime);
            const relative = getRelativeTimeString(lastUpdatedTime);

            statusElement.innerHTML =
                `Last update failed. Showing data from ${absolute} (${relative}).<br>
            Auto-updating every ${REFRESH_INTERVAL_MS / 1000} seconds.`
        } else {
            statusElement.innerHTML =
                `Last update failed.<br>
            Auto-updating every ${REFRESH_INTERVAL_MS / 1000} seconds.`
        }
        return;
    }

    // Success state (normal operation)
    if (lastUpdatedTime) {
        const absolute = formatStatusDateTime(lastUpdatedTime);
        const relative = getRelativeTimeString(lastUpdatedTime);

        statusElement.textContent =
            `Auto-updating every ${REFRESH_INTERVAL_MS / 1000} seconds · Last updated: ${absolute} (${relative})`;
        return;
    }

    // Idle state (before first successful load)
    statusElement.textContent =
        `Auto-updating every ${REFRESH_INTERVAL_MS / 1000} seconds.`;
}


/**
 * =========================================
 * TRANSACTION HISTORY RENDERING
 * =========================================
 * Displays all past trades in reverse chronological order.
 */
function renderTransactions() {
    const transactionsContainer = document.getElementById("transactions");
    
    // Logging for debugging purposes
    if (!transactionsContainer) {
        console.error('Missing element: #transactions');
        return;
    }

    transactionsContainer.innerHTML = "";

    if (portfolio.transactions.length === 0) {
        transactionsContainer.innerHTML = "<p>No transactions yet.</p>";
        return;
    }

    const recentTransactions = [...portfolio.transactions].reverse();

    for (const transaction of recentTransactions) {
        const transactionCard = document.createElement("div");
        transactionCard.className = "transaction-card";

        transactionCard.innerHTML = `
            <p><strong>${transaction.type}</strong> ${transaction.symbol}</p>
            <p>Price: $${transaction.price.toFixed(2)}</p>
            <p>Time: ${transaction.time}</p>
        `;

        transactionsContainer.appendChild(transactionCard);
    }
}


/**
 * =========================================
 * INSIGHTS RENDERING
 * =========================================
 * Displays structured insight cards with:
 * - visual emphasis based on insight type
 * - priority-based ordering (warning → positive → info)
 */
function renderInsights(insights) {
    const insightsContainer = document.getElementById("insights");

    // Logging for debugging purposes
    if (!insightsContainer) {
        console.error('Missing element: #insights');
        return;
    }

    insightsContainer.innerHTML = "";

    if (insights.length === 0) {
        insightsContainer.innerHTML = "<p>No insights available yet.</p>";
        return;
    }

    const priorityOrder = {
        warning: 0,
        positive: 1,
        info: 2
    };

    const sortedInsights = [...insights].sort((a, b) => {
        return priorityOrder[a.type] - priorityOrder[b.type];
    });

    for (const insight of sortedInsights) {
        const insightCard = document.createElement("div");
        insightCard.className = `insight-card insight-${insight.type}`;

        insightCard.innerHTML = `
            <div class="insight-label">${insight.title}</div>
            <p class="insight-message">${insight.message}</p>
        `;

        insightsContainer.appendChild(insightCard);
    }
}

/**
 * =========================================
 * INSIGHT SUMMARY RENDERING
 * =========================================
 * Displays a compact summary of insight counts
 * with a link to the full insights section.
 */
function renderInsightSummary(insights) {
    const summaryContainer = document.getElementById("insight-summary");
    
    
    // Logging for debugging purposes
    if (!summaryContainer) {
        console.error('Missing element: #insight-summary');
        return;
    }
    
    summaryContainer.innerHTML = "";

    let warningCount = 0;
    let positiveCount = 0;
    let infoCount = 0;

    for (const insight of insights) {
        if (insight.type === "warning") {
            warningCount += 1;
        } else if (insight.type === "positive") {
            positiveCount += 1;
        } else if (insight.type === "info") {
            infoCount += 1;
        }
    }

    summaryContainer.innerHTML = `
        <div class="insight-summary-bar">
            <span class="summary-warning">${warningCount} warning insight${warningCount === 1 ? "" : "s"}</span>
            <span class="summary-positive">${positiveCount} positive insight${positiveCount === 1 ? "" : "s"}</span>
            <span class="summary-info">${infoCount} informational insight${infoCount === 1 ? "" : "s"}</span>
            <a class="summary-link" href="#insights-section">Jump to insights</a>
        </div>
    `;
}