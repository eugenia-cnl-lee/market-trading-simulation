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
 * STOCK SELECTOR RENDERING
 * =========================================
 * Renders the dropdown used to add stocks from the
 * generated stock universe into the active watchlist.
 *
 * Behaviour:
 * - excludes symbols already in the active watchlist
 * - shows company name where available
 * - keeps selector options aligned with shared state
 */
function renderStockSelector() {
    const selector = document.getElementById("stock-selector");

    if (!selector) {
        return;
    }

    selector.innerHTML = "";

    const availableStocks = STOCK_UNIVERSE.filter(stock => {
        return !selectedSymbols.includes(stock.symbol);
    });

    if (availableStocks.length === 0) {
        selector.innerHTML = `<option value="">No more stocks available</option>`;
        selector.disabled = true;
        return;
    }

    selector.disabled = false;

    for (const stock of availableStocks) {
        const option = document.createElement("option");
        option.value = stock.symbol;
        option.textContent = `${stock.symbol} — ${stock.companyName ?? stock.symbol}`;
        selector.appendChild(option);
    }
}


/**
 * =========================================
 * WATCHLIST RENDERING
 * =========================================
 * Displays all stocks in the active market watchlist.
 * Each stock includes:
 * - symbol
 * - market metadata (exchange, region, sector, style)
 * - price
 * - change
 * - buy/sell actions routed through the execution layer
 * - quote status (live, stale, unavailable)
 * - exchange-specific market session state where available
 *
 * Behaviour:
 * - Renders normalised quote data from the shared market state
 * - Reads stock metadata from the backend-generated stock universe
 * - Displays fallback values when quotes are stale
 * - Handles unavailable or invalid quotes gracefully
 * - Applies visual indicators for price movement and quote status
 * - Supports per-exchange market context without making the UI
 *   responsible for market session fetching
 *
 * Design Note:
 * This function focuses purely on presentation, ensuring that
 * data reliability concerns, stock universe management, and
 * market session retrieval remain outside the UI layer.
 *
 * By separating metadata, quote state, and rendering concerns,
 * the watchlist becomes easier to extend later with selector UI,
 * region/sector grouping, and richer analytics visualisations.
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
        const stockMeta = typeof getStockMeta === "function"
            ? getStockMeta(symbol)
            : null;

        const exchange = stockMeta?.exchange ?? "Unknown exchange";
        const region = stockMeta?.region ?? "Unknown region";
        const sector = stockMeta?.sector ?? "Unknown sector";
        const style = stockMeta?.style ?? "Unknown style";

        const sessionData = stockMeta?.exchange && latestMarketSessions
            ? latestMarketSessions[stockMeta.exchange]
            : null;

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

        let sessionLabel = "Session unavailable";

        if (sessionData) {
            if (sessionData.session === "regular") {
                sessionLabel = "Open";
            } else if (sessionData.session === "pre-market") {
                sessionLabel = "Pre-Market";
            } else if (sessionData.session === "post-market") {
                sessionLabel = "Post-Market";
            } else {
                sessionLabel = "Closed";
            }
        }

        stockCard.innerHTML = `
            <h2 class="stock-symbol">${symbol}</h2>
            <p class="stock-name">${stockMeta?.companyName ?? ""}</p>
            <p class="stock-meta"><strong>Exchange:</strong> ${exchange}</p>
            <p class="stock-meta"><strong>Region:</strong> ${region}</p>
            <p class="stock-meta"><strong>Sector:</strong> ${sector}</p>
            <p class="stock-meta"><strong>Style:</strong> ${style}</p>
            <p class="stock-meta"><strong>Session:</strong> ${sessionLabel}</p>

            <p class="stock-price">Price: ${priceText}</p>
            <p class="stock-change">Change: ${changeText}</p>
            <p class="stock-state">Quote Status: ${quoteStateText}</p>

            <button class="buy-btn" onclick="handleBuy('${symbol}')">Buy</button>
            <button class="sell-btn" onclick="handleSell('${symbol}')">Sell</button>
            <button class="remove-btn" onclick="handleRemoveStock('${symbol}')">Remove</button>
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
 * - realised profit/loss
 * - unrealised profit/loss
 * - total return percentage
 *
 * Design Note:
 * This function renders portfolio metrics produced by the
 * portfolio module rather than calculating them in the UI layer.
 */
function renderPortfolioSummary(quotes) {
    const summary = document.getElementById("portfolio-summary");

    // Logging for debugging purposes
    if (!summary) {
        console.error('Missing element: #portfolio-summary');
        return;
    }

    const metrics = getPortfolioMetrics(quotes);
    
    summary.innerHTML = `
        <p><strong>Cash:</strong> $${metrics.cash.toFixed(2)}</p>
        <p><strong>Holdings Value:</strong> $${metrics.holdingsValue.toFixed(2)}</p>
        <p><strong>Total Portfolio Value:</strong> $${metrics.totalPortfolioValue.toFixed(2)}</p>
        <p><strong>Realised PnL:</strong> $${metrics.realisedPnL.toFixed(2)}</p>
        <p><strong>Unrealised PnL:</strong> $${metrics.unrealisedPnL.toFixed(2)}</p>
        <p><strong>Total Return:</strong> ${metrics.totalReturnPercent.toFixed(2)}%</p>
    `;
}


/**
 * =========================================
 * HOLDINGS RENDERING
 * =========================================
 * Displays each stock owned:
 * - quantity
 * - average cost
 * - current price
 * - market value
 * - unrealised profit/loss
 *
 * Behaviour:
 * - Uses holding performance data derived by the portfolio module
 * - Avoids recalculating financial metrics in the UI layer
 * - Preserves quote reliability states when market data is stale or unavailable
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
        const performance = getHoldingPerformance(symbol, quotes[symbol]);

        const holdingCard = document.createElement("div");
        holdingCard.className = "holding-card";

        const priceText = performance.currentPrice !== null
            ? `$${performance.currentPrice.toFixed(2)}`
            : "Unavailable";

        const marketValueText = performance.marketValue !== null
            ? `$${performance.marketValue.toFixed(2)}`
            : "Unavailable";

        const pnlText = performance.unrealisedPnL !== null
            ? `$${performance.unrealisedPnL.toFixed(2)}`
            : "Unavailable";

        const pnlClass = performance.unrealisedPnL !== null
            ? (performance.unrealisedPnL < 0 ? "negative" : "positive")
            : "";

        holdingCard.innerHTML = `
            <p><strong>${symbol}</strong></p>
            <p>Quantity: ${performance.quantity}</p>
            <p>Average Cost: $${performance.averageCost.toFixed(2)}</p>
            <p>Current Price: ${priceText}</p>
            <p>Market Value: ${marketValueText}</p>
            <p class="holding-pnl ${pnlClass}">
                Unrealised PnL: ${pnlText}
            </p>
        `;

        if (performance.isStale) {
            holdingCard.classList.add("stale-quote");
        }

        if (!performance.isValid) {
            holdingCard.classList.add("invalid-quote");
        }

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
 * 
 * This function does not represent whether the exchange
 * itself is open or closed. That is handled separately by
 * the market session indicator.
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
 * MARKET SESSION RENDERING
 * =========================================
 * Displays the current trading session of the exchange:
 * - Open (regular session)
 * - Pre-Market
 * - Post-Market
 * - Closed
 *
 * Behaviour:
 * - Renders real-world market session state separately
 *   from system refresh status
 * - Helps users interpret unchanged prices correctly
 * - Falls back gracefully if session data is unavailable
 *
 * Design Note:
 * This function communicates market conditions rather than
 * application state, reducing ambiguity when prices remain
 * static during non-trading hours.
 */
function renderMarketSession(sessionMap) {
    const sessionElement = document.getElementById("market-session");

    if (!sessionElement) {
        return;
    }

    if (!sessionMap || Object.keys(sessionMap).length === 0) {
        sessionElement.textContent = "Market Session: Unavailable";
        return;
    }

    const sessionLines = [];

    for (const exchange in sessionMap) {
        const sessionData = sessionMap[exchange];

        let sessionLabel = "Closed";
        let symbol = "◌";
        let className = "session-closed";

        if (sessionData?.session === "regular") {
            sessionLabel = "Open";
            symbol = "●";
            className = "session-open";
        } else if (sessionData?.session === "pre-market") {
            sessionLabel = "Pre-Market";
            symbol = "○";
            className = "session-pre";
        } else if (sessionData?.session === "post-market") {
            sessionLabel = "Post-Market";
            symbol = "◐";
            className = "session-post";
        }

        sessionLines.push(`
            <div class="market-session-row">
                <span class="market-session-label ${className}">
                    ${exchange}: ${symbol} ${sessionLabel}
                </span>
            </div>
        `);
    }

    sessionElement.innerHTML = `
        ${sessionLines.join("")}
        <span class="market-session-note">
            Session state is now tracked separately for each exchange in the active watchlist.
        </span>
    `;
}


/**
 * =========================================
 * TRANSACTION HISTORY RENDERING
 * =========================================
 * Displays all past trades in reverse chronological order.
 *
 * Behaviour:
 * - Supports both legacy transaction records and
 *   execution-aware transaction records
 * - Prefers execution price when available so the UI
 *   reflects actual trade outcomes rather than idealised
 *   displayed quote prices
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
            <p>Execution Price: $${(transaction.executionPrice ?? transaction.price).toFixed(2)}</p>
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