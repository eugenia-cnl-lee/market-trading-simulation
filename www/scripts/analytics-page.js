let analyticsStockUniverse = [];
let analyticsSelectedSymbols = [];

let analyticsAllocationChart = null;
let performanceMiniChart = null;
let reliabilityMiniChart = null;
let patternMiniChart = null;
let analyticsChartMode = "positions";

let latestAnalyticsQuotes = {};
let latestAnalyticsInsights = [];
let latestAnalyticsData = null;


function getStockMeta(symbol) {
    return analyticsStockUniverse.find(stock => stock.symbol === symbol) || {
        symbol,
        exchange: "US",
        region: "North America",
        sector: "Other",
        style: "Unknown"
    };
}


async function loadAnalyticsStockUniverse() {
    const response = await fetch("/api/stock-universe?limit=8");

    if (!response.ok) {
        throw new Error(`Failed to load analytics stock universe: HTTP ${response.status}`);
    }

    const universe = await response.json();

    if (!Array.isArray(universe) || universe.length === 0) {
        throw new Error("Analytics stock universe is empty or invalid");
    }

    analyticsStockUniverse = universe;
    analyticsSelectedSymbols = universe.slice(0, 8).map(stock => stock.symbol);
}

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
        await loadAnalyticsStockUniverse();

        const holdingSymbols = Object.keys(portfolio.holdings || {});

        // Forces analytics to focus on actual holdings first
        const requestedSymbols = holdingSymbols.length > 0
            ? holdingSymbols
            : analyticsSelectedSymbols;
        if (typeof getQuotes === "function") {
            const marketResult = await getQuotes(requestedSymbols, {});
            latestAnalyticsQuotes = marketResult.quotes || {};
        }

        const result = typeof generateInsights === "function"
            ? generateInsights(latestAnalyticsQuotes)
            : getAnalyticsMockFallback();

        latestAnalyticsInsights = result.insights || [];
        latestAnalyticsData = result.allocationData || getAnalyticsMockFallback().allocationData;

        console.log("holding symbols:", holdingSymbols);
        console.log("requested symbols:", requestedSymbols);
        console.log("allocation data:", latestAnalyticsData);

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
        return {
            labels: ["no data"],
            values: [100],
            descriptions: ["allocation data not available."]
        };
    }

    // -------------------------
    // POSITIONS
    // -------------------------
    if (analyticsChartMode === "positions") {
        const rows = allocation.sorted || [];

        return rows.length
            ? {
                labels: rows.slice(0, 6).map(r => r.symbol),
                values: rows.slice(0, 6).map(r => Number((r.weight || 0).toFixed(2))),
                descriptions: rows.slice(0, 6).map(r =>
                    `${r.symbol} accounts for ${(r.weight || 0).toFixed(2)}% of the portfolio.`
                )
            }
            : {
                labels: ["no positions"],
                values: [100],
                descriptions: ["no position data available."]
            };
    }

    // -------------------------
    // SECTOR
    // -------------------------
    if (analyticsChartMode === "sector") {
        const sector = allocation.sector || {};
        const labels = Object.keys(sector);

        return labels.length
            ? {
                labels,
                values: Object.values(sector).map(v => Number(v.toFixed(2))),
                descriptions: labels.map(l =>
                    `${l} contributes ${(sector[l] || 0).toFixed(2)}% of total portfolio exposure.`
                )
            }
            : {
                labels: ["no sector data"],
                values: [100],
                descriptions: ["sector allocation not available."]
            };
    }

    // -------------------------
    // STYLE
    // -------------------------
    if (analyticsChartMode === "style") {
        const style = allocation.style || {};
        const labels = Object.keys(style);

        return labels.length
            ? {
                labels,
                values: Object.values(style).map(v => Number(v.toFixed(2))),
                descriptions: labels.map(l =>
                    `${l} holdings contribute ${(style[l] || 0).toFixed(2)}% of portfolio weight.`
                )
            }
            : {
                labels: ["no style data"],
                values: [100],
                descriptions: ["style allocation not available."]
            };
    }
}


function renderAllocationChart() {
    const canvas = document.getElementById("allocation-chart");

    if (!canvas) {
        return;
    }

    const dataset = getChartDataset();

    console.log("chart mode:", analyticsChartMode);
    console.log("chart dataset:", dataset);

    if (analyticsAllocationChart) {
        analyticsAllocationChart.destroy();
    }

    const baseFills = [
        "#111111",
        "#f4f4f1",
        "#dcdcd6",
        "#262626",
        "#ffffff",
        "#bfbfb8"
    ];

    const baseBorders = [
        "#3d5afe",
        "#ff355e",
        "#3d5afe",
        "#ff355e",
        "#3d5afe",
        "#ff355e"
    ];

    const hoverFills = [
        "#3d5afe",
        "#ff355e",
        "#3d5afe",
        "#ff355e",
        "#3d5afe",
        "#ff355e"
    ];

    analyticsAllocationChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: dataset.labels,
            datasets: [
                {
                    data: dataset.values,
                    backgroundColor: dataset.values.map((_, index) => baseFills[index % baseFills.length]),
                    borderColor: dataset.values.map((_, index) => baseBorders[index % baseBorders.length]),
                    hoverBackgroundColor: dataset.values.map((_, index) => hoverFills[index % hoverFills.length]),
                    hoverBorderColor: dataset.values.map((_, index) => baseBorders[index % baseBorders.length]),
                    borderWidth: 3,
                    hoverBorderWidth: 5,
                    hoverOffset: 20
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "58%",
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 700
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#0b0b0b",
                        boxWidth: 14,
                        padding: 16,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: "#111111",
                    titleColor: "#ffffff",
                    bodyColor: "#ffffff",
                    borderColor: "#3d5afe",
                    borderWidth: 1,
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

function renderPortfolioSummary() {
    const metrics = getPortfolioMetrics(latestAnalyticsQuotes);
    const allocation = latestAnalyticsData;

    const totalValue = metrics.totalPortfolioValue || 0;

    const cashRatio = totalValue > 0
        ? portfolio.cash / totalValue
        : 0;

    const transactionCount = portfolio.transactions.length;

    document.getElementById("stat-total-value").textContent =
        `$${totalValue.toFixed(2)}`;

    document.getElementById("stat-total-return").textContent =
        `return: ${(metrics.totalReturnPercent || 0).toFixed(2)}%`;

    document.getElementById("stat-cash-ratio").textContent =
        `${(cashRatio * 100).toFixed(1)}%`;

    document.getElementById("stat-cash-state").textContent =
        cashRatio >= 0.7 ? "cash heavy"
        : cashRatio <= 0.2 ? "mostly invested"
        : "balanced";

    document.getElementById("stat-top1").textContent =
        `${(allocation?.concentration?.top1 || 0).toFixed(1)}%`;

    document.getElementById("stat-top3").textContent =
        `top 3: ${(allocation?.concentration?.top3 || 0).toFixed(1)}%`;

    document.getElementById("stat-transactions").textContent =
        transactionCount;

    document.getElementById("stat-activity-level").textContent =
        transactionCount === 0
            ? "none"
            : transactionCount <= 3
                ? "low"
                : transactionCount <= 7
                    ? "moderate"
                    : "high";
}

function renderPortfolioExposure() {
    const container = document.getElementById("leaderboard-list");
    const positions = latestAnalyticsData?.sorted || [];

    container.innerHTML = "";

    if (!positions.length) {
        container.innerHTML = `
            <div class="leaderboard-row">
                <div></div>
                <div class="leaderboard-meta">no portfolio exposure available yet</div>
                <div></div>
            </div>
        `;
        return;
    }

    positions.slice(0, 8).forEach((position, index) => {
        const weight = position.weight || 0;
        const marketValue = position.marketValue || 0;
        const unrealisedPnL = position.unrealisedPnL || 0;

        const row = document.createElement("div");
        row.className = "leaderboard-row";

        row.innerHTML = `
            <div class="leaderboard-rank">${index + 1}</div>
            <div>
                <div class="leaderboard-symbol">${position.symbol}</div>
                <div class="leaderboard-meta">
                    mv: $${marketValue.toFixed(2)} · pnl: $${unrealisedPnL.toFixed(2)}
                </div>
            </div>
            <div class="leaderboard-weight">${weight.toFixed(2)}%</div>
        `;

        row.addEventListener("mouseenter", () => {
            updateDetailCard(
                position.symbol,
                `${position.symbol} holds ${weight.toFixed(2)}% of the portfolio and has unrealised pnl of $${unrealisedPnL.toFixed(2)}.`,
                `${weight.toFixed(2)}%`
            );
        });

        row.addEventListener("click", () => {
            analyticsChartMode = "positions";

            document.querySelectorAll(".chart-mode-btn").forEach(button => {
                button.classList.remove("active");
            });

            document.querySelector('[data-mode="positions"]')?.classList.add("active");

            renderAllocationChart();

            updateDetailCard(
                position.symbol,
                `${position.symbol} is selected from portfolio exposure.`,
                `${weight.toFixed(2)}%`
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

function bindAnalyticsPanelHover() {
    const exposurePanel = document.getElementById("portfolio-exposure-panel");
    const performanceCard = document.getElementById("performance-card");
    const reliabilityCard = document.getElementById("reliability-card");
    const patternCard = document.getElementById("pattern-card");

    exposurePanel?.addEventListener("mouseenter", () => {
        const positions = latestAnalyticsData?.sorted || [];

        if (!positions.length) {
            updateDetailCard(
                "portfolio exposure",
                "ranked exposure lists holdings by portfolio weight once allocation data is available."
            );
            return;
        }

        const topPosition = positions[0];

        updateDetailCard(
            "portfolio exposure",
            "this panel ranks your holdings by allocation weight, showing which positions dominate portfolio exposure.",
            `${topPosition.symbol}: ${(topPosition.weight || 0).toFixed(2)}%`
        );
    });

    performanceCard?.addEventListener("mouseenter", () => {
        const metrics = getPortfolioMetrics(latestAnalyticsQuotes);
        const state =
            metrics.unrealisedPnL > 0 ? "profit" :
            metrics.unrealisedPnL < 0 ? "loss" :
            "breakeven";

        updateDetailCard(
            "performance state",
            "this panel summarises unrealised portfolio performance based on current holdings and live quote valuations.",
            `${state} · $${(metrics.unrealisedPnL || 0).toFixed(2)}`
        );
    });

    reliabilityCard?.addEventListener("mouseenter", () => {
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

        updateDetailCard(
            "data reliability",
            "this panel reflects whether your portfolio analysis is being driven by live, stale, or missing market data.",
            `usable: ${usableHoldingCount}, stale: ${staleCount}, invalid: ${invalidCount}`
        );
    });

    patternCard?.addEventListener("mouseenter", () => {
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
            buyCount > sellCount ? "buying" :
            sellCount > buyCount ? "selling" :
            "balanced";

        updateDetailCard(
            "trading pattern",
            "this panel compares buy and sell behaviour to indicate whether recent trading is accumulation-focused or distribution-focused.",
            `${patternBias} · buy: ${buyCount}, sell: ${sellCount}`
        );
    });
}

function bindStatCardHover() {
    document.querySelectorAll(".analytics-stat-card").forEach(card => {
        card.addEventListener("mouseenter", () => {
            const panel = card.dataset.panel;
            const metrics = getPortfolioMetrics(latestAnalyticsQuotes);
            const cashRatio = metrics.totalPortfolioValue > 0
                ? portfolio.cash / metrics.totalPortfolioValue
                : 0;

            if (panel === "portfolio") {
                updateDetailCard(
                    "portfolio value",
                    "total portfolio value combines cash and holdings value.",
                    `$${(metrics.totalPortfolioValue || 0).toFixed(2)}`
                );
            }

            if (panel === "cash") {
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
                    "transaction count indicates how actively the portfolio has been managed.",
                    `${portfolio.transactions.length} trades`
                );
            }
        });

        card.addEventListener("click", () => {
            const panel = card.dataset.panel;

            if (panel === "portfolio" || panel === "cash" || panel === "concentration" || panel === "activity") {
                analyticsChartMode = "positions";
            }

            document.querySelectorAll(".chart-mode-btn").forEach(btn => {
                btn.classList.remove("active");
            });

            document.querySelector(`[data-mode="${analyticsChartMode}"]`)?.classList.add("active");

            renderAllocationChart();
        });
    });
}

function renderAnalyticsDashboard() {
    renderPortfolioSummary();
    renderAllocationChart();
    renderPortfolioExposure();
    renderInsightsPanel();
    renderMiniCharts();
}

window.addEventListener("load", async () => {
    bindAnalyticsModeButtons();
    bindStatCardHover();
    bindAnalyticsPanelHover();
    await loadAnalyticsPageData();
});