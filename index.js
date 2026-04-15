const API_KEY = "d7fpushr01qqb8rh69p0d7fpushr01qqb8rh69pg";

// Logging for easy debugging
console.log("Server starting on http://localhost:10101");

Bun.serve({
    port: 10101,

    async fetch(request) {
        const url = new URL(request.url);
        console.log("Incoming request:", url.pathname + url.search);

        if (url.pathname === "/api/quote") {
            const symbol = url.searchParams.get("symbol");
            console.log("Symbol received:", symbol);

            if (!symbol) {
                return new Response(JSON.stringify({ error: "Missing symbol" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const apiUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
            console.log("Calling Finnhub:", apiUrl);

            try {
                const response = await fetch(apiUrl);
                const data = await response.json();

                console.log("Finnhub response:", data);

                return new Response(JSON.stringify(data), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (error) {
                console.error("Fetch error:", error);

                return new Response(JSON.stringify({ error: "Failed to fetch from Finnhub" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        const path = "www" + (url.pathname === "/" ? "/index.htm" : url.pathname);
        console.log("Serving file:", path);
        return new Response(Bun.file(path));
    }
});