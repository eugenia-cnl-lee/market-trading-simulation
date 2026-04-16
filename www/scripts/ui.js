/**
 * =========================================
 * WATCHLIST RENDERING
 * =========================================
 * Displays all stocks in the market watchlist.
 * Each stock includes:
 * - price
 * - change
 * - buy/sell buttons
 */
function renderWatchlist(quotes) {
    const watchlist = document.getElementById("watchlist");

    // Logging for debugging purposes
    if (!watchlist) {
        console.error('Missing element: #watchlist');
        return;
    }

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

        // Apply conditional styling for price movement
        const changeElement = stockCard.querySelector(".stock-change");

        if (data.d < 0) {
            changeElement.classList.add("negative");
        } else {
            changeElement.classList.add("positive");
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
        const currentPrice = quotes[symbol]?.c || 0;
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