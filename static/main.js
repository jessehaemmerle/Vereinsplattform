console.log("Vereinsverwaltung gestartet.");

// Hier könntest du z.B. AJAX-Funktionen implementieren
// oder UI-Interaktionen handhaben.
document.addEventListener("DOMContentLoaded", () => {
    // Überprüfen, ob ein Theme im localStorage gespeichert ist
    const savedTheme = localStorage.getItem("theme");
    const htmlElement = document.documentElement;

    if (savedTheme) {
        htmlElement.setAttribute("data-theme", savedTheme);
    }

    // Funktion zum Umschalten zwischen hell und dunkel
    const toggleTheme = (newTheme) => {
        htmlElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    };

    // Event Listener für das Dropdown-Menü auf der Einstellungsseite
    const themeSelector = document.getElementById("theme");
    if (themeSelector) {
        themeSelector.value = savedTheme || "light";
        themeSelector.addEventListener("change", (event) => {
            toggleTheme(event.target.value);
        });
    }
});

// static/js/dashboard.js