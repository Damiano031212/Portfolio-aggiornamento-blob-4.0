document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.querySelector(".cursor");

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    const speed = 1;

    document.body.style.cursor = "none";

    setTimeout(() => {
        cursor.style.opacity = 1;
    }, 300);

    let freezeCursor = false;
    let hasDetectedMouse = false;

    // ⭐️ Stato hover sfera (viene aggiornato da sfera.js)
    let isHoverSphere = false;

    // ⭐️ Stati del cursore
    let isHovered = false;
    let isPressed = false;

    function setCursorToCenter() {
        mouseX = window.innerWidth / 2;
        mouseY = window.innerHeight / 2;
        cursorX = mouseX;
        cursorY = mouseY;
        cursor.style.left = cursorX + "px";
        cursor.style.top = cursorY + "px";
    }

    setCursorToCenter();

    document.addEventListener("mousemove", (e) => {
        if (freezeCursor) return;
        hasDetectedMouse = true;

        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    document.addEventListener("pointermove", (e) => {
        if (freezeCursor) return;

        hasDetectedMouse = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    window.addEventListener("resize", () => {
        if (!hasDetectedMouse) setCursorToCenter();
    });

    // ⭐ ANIMAZIONE MOVIMENTO (lerp)
    function animate() {
        cursorX += (mouseX - cursorX) * speed;
        cursorY += (mouseY - cursorY) * speed;

        cursor.style.left = cursorX + "px";
        cursor.style.top = cursorY + "px";

        // ⭐ Integra stato hover della sfera
        if (window.isHoverSphere !== isHoverSphere) {
            isHoverSphere = window.isHoverSphere;
            applyCursorScale();
        }

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

    const interactive = document.querySelectorAll("a, button, .clickable");

    // ⭐ SCALA DEL CURSORE IN BASE ALLO STATO
    function applyCursorScale() {
        if (isPressed) {
            cursor.style.transform = "translate(-50%, -50%) scale(0.6)";
        } else if (isHovered || isHoverSphere) {
            cursor.style.transform = "translate(-50%, -50%) scale(2)";
        } else {
            cursor.style.transform = "translate(-50%, -50%) scale(1)";
        }
    }

    // ⭐ Hover su elementi HTML interattivi
    interactive.forEach((el) => {
        el.addEventListener("mouseenter", () => {
            isHovered = true;
            applyCursorScale();
        });

        el.addEventListener("mouseleave", () => {
            isHovered = false;
            applyCursorScale();
        });

        el.addEventListener("pointerdown", (ev) => {
            if (ev.button !== undefined && ev.button !== 0) return;
            isPressed = true;
            applyCursorScale();
        });

        el.addEventListener("pointerup", () => {
            isPressed = false;
            applyCursorScale();
        });
    });

    // ⭐ Click riconosciuto anche sulla sfera
    document.addEventListener("pointerdown", () => {
        if (isHoverSphere) {
            isPressed = true;
            applyCursorScale();
        }
    });

    document.addEventListener("pointerup", () => {
        if (isPressed) {
            isPressed = false;
            applyCursorScale();
        }
    });

    // ⭐⭐⭐ FULL-FILL TRANSITION ⭐⭐⭐
    const projectButtons = document.querySelectorAll("button.container_box");
    let isButtonAnimating = false;

    projectButtons.forEach((btn) => {
        btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            if (isButtonAnimating) return;

            const parentA = btn.closest("a");
            const targetHref = parentA?.href || btn.dataset.href || null;
            if (!targetHref) return;

            isButtonAnimating = true;
            document.body.style.pointerEvents = "none";

            // 🔒 ferma il cursore
            freezeCursor = true;
            mouseX = cursorX;
            mouseY = cursorY;

            const comp = getComputedStyle(cursor);
            const origWidth = comp.width || "50px";
            const origHeight = comp.height || "50px";

            const expandDuration = 900;
            const shrinkDuration = 700;

            cursor.style.transition =
                "width 0.9s cubic-bezier(.86,0,.07,1), height 0.9s cubic-bezier(.86,0,.07,1), transform 0.25s ease";

            // ⭐ ESPANSIONE
            requestAnimationFrame(() => {
                cursor.style.width = "500vh";
                cursor.style.height = "500vh";
            });

            // ⭐ RITORNO GRADUALE
            const expandTimeout = setTimeout(() => {
                cursor.style.transition =
                    "width 0.6s cubic-bezier(.2,.9,.3,1), height 0.6s cubic-bezier(.2,.9,.3,1), transform 0.2s ease";

                cursor.style.width = origWidth;
                cursor.style.height = origHeight;

                const finalTimeout = setTimeout(() => {
                    location.href = targetHref;
                }, shrinkDuration - 100);
            }, expandDuration);

            // ⭐ FAIL-SAFE (in caso di interruzione imprevista)
            const safetyTimeout = setTimeout(() => {
                if (isButtonAnimating) {
                    freezeCursor = false;
                    document.body.style.pointerEvents = "";
                    isButtonAnimating = false;
                    location.href = targetHref;
                }
            }, 3000);
        });
    });

});
