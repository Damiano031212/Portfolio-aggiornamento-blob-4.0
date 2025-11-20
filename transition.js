document.addEventListener("DOMContentLoaded", () => {
  const shutter = document.createElement("div");
  shutter.className = "page-shutter";
  document.body.appendChild(shutter);

  let isAnimating = false;

  function clearFlag() {
    sessionStorage.removeItem("pageTransition");
  }

  function finishReveal() {
    // lascia la tendina presente ma nello stato nascosto
    shutter.classList.remove("down");
    isAnimating = false;
    clearFlag();
  }

  // se arrivo da navigazione precedente: parto coperto e poi sollevo
  if (sessionStorage.getItem("pageTransition") === "1") {
    // posizione iniziale coperta senza transizione visibile
    shutter.style.transition = "none";
    shutter.classList.add("down");
    shutter.getBoundingClientRect();
    shutter.style.transition = "";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      shutter.classList.remove("down");
    }));
    // al termine della salita sblocca
    shutter.addEventListener("transitionend", function handler(e) {
      if (e.propertyName === "transform") {
        isAnimating = false;
        clearFlag();
        shutter.removeEventListener("transitionend", handler);
      }
    }, { once: true });
  }

  const navLinks = document.querySelectorAll("nav a");
  navLinks.forEach((a) => {
    a.addEventListener("click", (ev) => {
      const url = new URL(a.href, location.href);

      // ignora link esterni
      if (url.origin !== location.origin) return;

      // trattiamo anchor interni (same-page + hash)
      const isSamePageHash = (url.pathname === location.pathname) && !!url.hash;

      ev.preventDefault();

      // evita click ripetuti durante animazione
      if (isAnimating) return;
      isAnimating = true;

      // fallback in caso transitionend non scatti (sblocca dopo tempo adeguato alla risalita)
      const fallback = setTimeout(() => {
        isAnimating = false;
        clearFlag();
      }, 2600); // aumentato per coprire la risalita più lenta (1.2s + margine)

      if (isSamePageHash) {
        // scende la tendina, cambia hash, risale
        shutter.classList.add("down");

        const onDown = (e) => {
          if (e.propertyName !== "transform") return;
          shutter.removeEventListener("transitionend", onDown);
          // aggiorna hash (scroll automatico)
          location.hash = url.hash;
          // risale la tendina
          requestAnimationFrame(() => shutter.classList.remove("down"));

          // quando ha terminato la salita
          shutter.addEventListener("transitionend", function onUp(ev2) {
            if (ev2.propertyName !== "transform") return;
            clearTimeout(fallback);
            finishReveal();
            shutter.removeEventListener("transitionend", onUp);
          }, { once: true });
        };

        shutter.addEventListener("transitionend", onDown, { once: true });
      } else {
        // navigazione verso altra pagina (o stesso href)
        sessionStorage.setItem("pageTransition", "1");
        shutter.classList.add("down");

        const onDownFull = (e) => {
          if (e.propertyName !== "transform") return;
          shutter.removeEventListener("transitionend", onDownFull);
          clearTimeout(fallback);

          // se destinazione è esattamente l'URL corrente -> forziamo reload
          if (url.href === location.href) {
            clearFlag();
            // forza reload per riprodurre l'effetto
            location.reload();
          } else {
            location.href = url.href;
          }
        };

        shutter.addEventListener("transitionend", onDownFull, { once: true });
      }
    });
  });
});