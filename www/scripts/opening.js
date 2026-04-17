const bgMusic = document.getElementById("bg-music");
const flash = document.getElementById("screen-flash");
const redPill = document.getElementById("red-pill");
const bluePill = document.getElementById("blue-pill");

const overlay = document.getElementById("system-overlay");
const message = document.getElementById("system-message");

/* =========================================
   AUDIO INITIALISATION
   =========================================
   Attempts to start the opening background audio.
*/
async function tryAutoplayMusic() {
    bgMusic.volume = 0.35;

    try {
        await bgMusic.play();
    } catch (error) {
        console.log("autoplay blocked by browser:", error);
    }
}

/* =========================================
   TYPEWRITER EFFECT
   =========================================
   Types text into a target element for the
   opening-screen narrative lines.
*/
function typeText(elementId, text, speed = 60, delay = 0) {
    const element = document.getElementById(elementId);
    let index = 0;

    setTimeout(() => {
        const timer = setInterval(() => {
            element.textContent += text[index];
            index += 1;

            if (index >= text.length) {
                clearInterval(timer);
            }
        }, speed);
    }, delay);
}

/* =========================================
   OVERLAY TYPEWRITER EFFECT
   =========================================
   Types the transition message shown after
   the user selects a route.
*/
function typeOverlayMessage(text, speed = 35) {
    message.textContent = "";
    let index = 0;

    const timer = setInterval(() => {
        message.textContent += text[index];
        index += 1;

        if (index >= text.length) {
            clearInterval(timer);
        }
    }, speed);
}

/* =========================================
   SYSTEM TRANSITION
   =========================================
   Shows the full-screen overlay, types a
   system message, then routes the user to
   the chosen interface.
*/
function triggerTransition(mode) {
    overlay.classList.remove("hidden");

    requestAnimationFrame(() => {
        overlay.classList.add("active");
    });

    const overlayText =
        mode === "trade"
            ? "entering execution interface_"
            : "loading analytics layer_";

    typeOverlayMessage(overlayText, 35);

    setTimeout(() => {
        window.location.href =
            mode === "trade"
                ? "overview.htm"
                : "analytics.htm";
    }, 1600);
}

/* =========================================
   PILL SELECTION HANDLER
   =========================================
   Plays the screen flash first, then starts
   the transition overlay sequence.
*/
function choosePill(type) {
    flash.classList.add("active");

    setTimeout(() => {
        if (type === "red") {
            triggerTransition("trade");
        } else {
            triggerTransition("analytics");
        }
    }, 420);
}

/* =========================================
   INITIAL PAGE LOAD
   =========================================
   Starts background audio and types the
   opening-screen narrative text.
*/
window.addEventListener("load", () => {
    tryAutoplayMusic();

    typeText("hint-text", "initialising choice architecture", 34, 200);
    typeText("title-text", "choose your position", 70, 900);
    typeText("subtitle-text", "capital follows decision", 48, 2300);
});

/* =========================================
   EVENT BINDINGS
   =========================================
   Connects each pill button to its route.
*/
redPill.addEventListener("click", () => choosePill("red"));
bluePill.addEventListener("click", () => choosePill("blue"));