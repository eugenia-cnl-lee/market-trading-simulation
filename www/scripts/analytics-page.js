let analyticsAllocationChart = null;
let performanceMiniChart = null;
let reliabilityMiniChart = null;
let patternMiniChart = null;
let analyticsChartMode = "positions";

let latestAnalyticsQuotes = {};
let latestAnalyticsInsights = [];
let latestAnalyticsData = null;

function getAnalyticsMockFallback() {
    return {
        insights: [
            {
                type: "info",
                title: "dashboard preview",
                message: "live analytics will appear once market data loads."
            }
        ],
        allocationData: {
            positions: [],
            sorted: [],
            concentration: {
                top1: 0,
                top3: 0
            },
            sector: {},
            style: {},
            dominantSector: null,
            dominantSectorWeight: 0,
            dominantStyle: null,
            dominantStyleWeight: 0
        }
    };
}

async function loadAnalyticsPageData() {
    try {
        if (typeof loadStockUniverse === "function") {
            await loadStockUniverse();
        }

        if (typeof getQuotes === "function") {
            const marketResult = await getQuotes(selectedSymbols, {});
            latestAnalyticsQuotes = marketResult.quotes || {};
        }

        const result = typeof generateInsights === "function"
            ? generateInsights(latestAnalyticsQuotes)
            : getAnalyticsMockFallback();

        latestAnalyticsInsights = result.insights || [];
        latestAnalyticsData = result.allocationData || getAnalyticsMockFallback().allocationData;

        renderAnalyticsDashboard();
    } catch (error) {
        console.error("failed to load analytics page:", error);

        const fallback = getAnalyticsMockFallback();
        latestAnalyticsInsights = fallback.insights;
        latestAnalyticsData = fallback.allocationData;

        renderAnalyticsDashboard();
    }
}

function updateDetailCard(title, description, value = "") {
    document.getElementById("detail-title").textContent = title;
    document.getElementById("detail-description").textContent = description;
    document.getElementById("detail-value").textContent = value;
}

function getChartDataset() {
    const allocation = latestAnalyticsData;

    if (!allocation) {
        return { labels: [], values: [], descriptions: [] };
    }

    if (analyticsChartMode === "positions") {
        const rows = allocation.sorted.slice(0, 6);

        return {
            labels: rows.map(row => row.symbol),
            values: rows.map(row => Number((row.weight || 0).toFixed(2))),
            descriptions: rows.map(row =>
                `${row.symbol} accounts for ${(row.weight || 0).toFixed(2)}% of the portfolio.`
            )
        };
    }

    if (analyticsChartMode === "sector") {
        const labels = Object.keys(allocation.sector || {});
        const values = Object.values(allocation.sector || {}).map(value => Number(value.toFixed(2)));

        return {
            labels,
            values,
            descriptions: labels.map(label =>
                `${label} contributes ${(allocation.sector[label] || 0).toFixed(2)}% of total portfolio exposure.`
            )
        };
    }

    const labels = Object.keys(allocation.style || {});
    const values = Object.values(allocation.style || {}).map(value => Number(value.toFixed(2)));

    return {
        labels,
        values,
        descriptions: labels.map(label =>
            `${label} holdings contribute ${(allocation.style[label] || 0).toFixed(2)}% of portfolio weight.`
        )
    };
}

function renderAllocationChart() {
    const canvas = document.getElementById("allocation-chart");
    if (!canvas) {
        return;
    }

    const dataset = getChartDataset();

    if (analyticsAllocationChart) {
        analyticsAllocationChart.destroy();
    }

    analyticsAllocationChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: dataset.labels,
            datasets: [
                {
                    data: dataset.values,
                    hoverOffset: 18,
                    borderWidth: 1,
                    borderColor: "#0d0d0d",
                    backgroundColor: [
                        "#f4f4f1",
                        "#ecece8",
                        "#e2e2dd",
                        "#d7d7d1",
                        "#ccccc5",
                        "#c0c0b8"
                    ]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 900
            },
            plugins: {
                legend: {
                    position: "bottom"
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return `${context.label}: ${context.raw}%`;
                        }
                    }
                }
            },
            onHover(event, elements) {
                canvas.style.cursor = elements.length ? "pointer" : "default";

                if (!elements.length) {
                    return;
                }

                const index = elements[0].index;
                updateDetailCard(
                    dataset.labels[index],
                    dataset.descriptions[index],
                    `${dataset.values[index]}%`
                );
            },
            onClick(event, elements) {
                if (!elements.length) {
                    return;
                }

                const index = elements[0].index;
                updateDetailCard(
                    `${dataset.labels[index]} selected`,
                    dataset.descriptions[index],
                    `${dataset.values[index]}%`
                );
            }
        }
    });

    updateDetailCard(
        "allocation details",
        `viewing portfolio by ${analyticsChartMode}. hover or click a slice to inspect it.`
    );
}

function renderHeroStats() {
    const metrics = typeof getPortfolioMetrics === "function"
        ? getPortfolioMetrics(latestAnalyticsQuotes)
        : {
            totalPortfolioValue: 0,
            totalReturnPercent: 0
        };

    const allocation = latestAnalyticsData;
    const activity = latestAnalyticsData?.tradingActivity;
    const cashPosition = latestAnalyticsData?.cashPosition;

    document.getElementById("stat-total-value").textContent =
        `$${(metrics.totalPortfolioValue || 0).toFixed(2)}`;

    document.getElementById("stat-total-return").textContent =
        `return: ${(metrics.totalReturnPercent || 0).toFixed(2)}%`;

    document.getElementById("stat-cash-ratio").textContent =
        `${((cashPosition?.cashRatio || 0) * 100).toFixed(1)}%`;

    document.getElementById("stat-cash-state").textContent =
        cashPosition?.state || "balanced";

    document.getElementById("stat-top1").textContent =
        `${(allocation?.concentration?.top1 || 0).toFixed(1)}%`;

    document.getElementById("stat-top3").textContent =
        `top 3: ${(allocation?.concentration?.top3 || 0).toFixed(1)}%`;

    document.getElementById("stat-transactions").textContent =
        activity?.transactionCount || 0;

    document.getElementById("stat-activity-level").textContent =
        activity?.activityLevel || "none";
}

function renderLeaderboard() {
    const container = document.getElementById("leaderboard-list");
    const positions = latestAnalyticsData?.sorted || [];

    container.innerHTML = "";

    if (!positions.length) {
        container.innerHTML = `<div class="leaderboard-row"><div></div><div class="leaderboard-meta">no positions yet</div><div></div></div>`;
        return;
    }

    positions.slice(0, 8).forEach((position, index) => {
        const row = document.createElement("div");
        row.className = "leaderboard-row";

        row.innerHTML = `
            <div class="leaderboard-rank">${index + 1}</div>
            <div>
                <div class="leaderboard-symbol">${position.symbol}</div>
                <div class="leaderboard-meta">
                    mv: $${(position.marketValue || 0).toFixed(2)} · pnl: $${(position.unrealisedPnL || 0).toFixed(2)}
                </div>
            </div>
            <div class="leaderboard-weight">${(position.weight || 0).toFixed(2)}%</div>
        `;

        row.addEventListener("mouseenter", () => {
            updateDetailCard(
                position.symbol,
                `${position.symbol} holds ${(position.weight || 0).toFixed(2)}% of the portfolio and has unrealised pnl of $${(position.unrealisedPnL || 0).toFixed(2)}.`,
                `${(position.weight || 0).toFixed(2)}%`
            );
        });

        container.appendChild(row);
    });
}

function renderInsightsPanel() {
    const container = document.getElementById("analytics-insight-list");
    container.innerHTML = "";

    if (!latestAnalyticsInsights.length) {
        container.innerHTML = `<div class="analytics-insight-card info"><h4>no insights yet</h4><p>start trading to generate behavioural signals.</p></div>`;
        return;
    }

    latestAnalyticsInsights.forEach(insight => {
        const card = document.createElement("div");
        card.className = `analytics-insight-card ${insight.type || "info"}`;
        card.innerHTML = `
            <h4>${insight.title}</h4>
            <p>${insight.message}</p>
        `;

        card.addEventListener("mouseenter", () => {
            updateDetailCard(insight.title, insight.message);
        });

        container.appendChild(card);
    });
}

function renderMiniCharts() {
    const metrics = getPortfolioMetrics(latestAnalyticsQuotes);

    let staleCount = 0;
    let invalidCount = 0;
    let usableHoldingCount = 0;

    for (const symbol in portfolio.holdings) {
        const quote = latestAnalyticsQuotes[symbol];

        if (!quote) {
            invalidCount += 1;
            continue;
        }

        if (quote.isStale) {
            staleCount += 1;
            usableHoldingCount += 1;
            continue;
        }

        if (!quote.isValid) {
            invalidCount += 1;
            continue;
        }

        usableHoldingCount += 1;
    }

    let buyCount = 0;
    let sellCount = 0;

    for (const transaction of portfolio.transactions) {
        if (transaction.type === "BUY") {
            buyCount += 1;
        } else if (transaction.type === "SELL") {
            sellCount += 1;
        }
    }

    const patternBias =
        buyCount > sellCount ? "buying"
        : sellCount > buyCount ? "selling"
        : "balanced";

    document.getElementById("perf-state").textContent =
        metrics.unrealisedPnL > 0 ? "profit"
        : metrics.unrealisedPnL < 0 ? "loss"
        : "breakeven";

    document.getElementById("perf-pnl").textContent =
        `unrealised: $${(metrics.unrealisedPnL || 0).toFixed(2)}`;

    document.getElementById("reliability-state").textContent =
        invalidCount > 0 ? "unstable"
        : staleCount > 0 ? "delayed"
        : "stable";

    document.getElementById("reliability-detail").textContent =
        `stale: ${staleCount}, invalid: ${invalidCount}`;

    document.getElementById("pattern-bias").textContent = patternBias;
    document.getElementById("pattern-detail").textContent =
        `buy: ${buyCount}, sell: ${sellCount}`;

    if (performanceMiniChart) {
        performanceMiniChart.destroy();
    }
    if (reliabilityMiniChart) {
        reliabilityMiniChart.destroy();
    }
    if (patternMiniChart) {
        patternMiniChart.destroy();
    }

    performanceMiniChart = new Chart(document.getElementById("performance-mini-chart"), {
        type: "bar",
        data: {
            labels: ["pnl"],
            datasets: [{
                data: [metrics.unrealisedPnL || 0]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    reliabilityMiniChart = new Chart(document.getElementById("reliability-mini-chart"), {
        type: "doughnut",
        data: {
            labels: ["usable", "stale", "invalid"],
            datasets: [{
                data: [usableHoldingCount, staleCount, invalidCount]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    patternMiniChart = new Chart(document.getElementById("pattern-mini-chart"), {
        type: "bar",
        data: {
            labels: ["buy", "sell"],
            datasets: [{
                data: [buyCount, sellCount]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function bindAnalyticsModeButtons() {
    document.querySelectorAll(".chart-mode-btn").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".chart-mode-btn").forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");
            analyticsChartMode = button.dataset.mode;
            renderAllocationChart();
        });
    });
}

function bindStatCardHover() {
    document.querySelectorAll(".analytics-stat-card").forEach(card => {
        card.addEventListener("mouseenter", () => {
            const panel = card.dataset.panel;

            if (panel === "portfolio") {
                const metrics = getPortfolioMetrics(latestAnalyticsQuotes);
                updateDetailCard(
                    "portfolio value",
                    "total portfolio value combines cash and holdings value.",
                    `$${(metrics.totalPortfolioValue || 0).toFixed(2)}`
                );
            }

            if (panel === "cash") {
                const cashRatio = latestAnalyticsData?.cashPosition?.cashRatio || 0;
                updateDetailCard(
                    "cash ratio",
                    "this shows how much of the portfolio remains uninvested.",
                    `${(cashRatio * 100).toFixed(1)}%`
                );
            }

            if (panel === "concentration") {
                updateDetailCard(
                    "concentration",
                    "top position and top 3 weights show how dominant the largest holdings are.",
                    `${(latestAnalyticsData?.concentration?.top1 || 0).toFixed(1)}% top 1`
                );
            }

            if (panel === "activity") {
                updateDetailCard(
                    "trading activity",
                    "transaction count and activity level indicate how aggressively the portfolio is being managed.",
                    `${latestAnalyticsData?.tradingActivity?.transactionCount || 0} trades`
                );
            }
        });
    });
}

function renderAnalyticsDashboard() {
    renderHeroStats();
    renderAllocationChart();
    renderLeaderboard();
    renderInsightsPanel();
    renderMiniCharts();
}

window.addEventListener("load", async () => {
    bindAnalyticsModeButtons();
    bindStatCardHover();
    await loadAnalyticsPageData();
});