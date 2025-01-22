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

$(document).ready(function () {
    let removeMode = false;
  
    // Initialize the dashboard
    initDashboard();
  
    // Toggle widget dropdown
    $('#addWidgetButton').on('click', function () {
      $('#widgetDropdown').toggle();
    });
  
    // Add widget from dropdown
    $('#confirmWidgetButton').on('click', function () {
      const selectedWidget = $('#widgetSelect').val();
      if (selectedWidget) {
        addWidget(selectedWidget);
        $('#widgetDropdown').hide();
      } else {
        alert('Bitte wählen Sie ein Widget aus.');
      }
    });
  
    // Toggle remove mode
    $('#toggleRemoveMode').on('click', function () {
      removeMode = !removeMode;
      $('.widget-remove-btn').toggle(removeMode);
      $(this).text(removeMode ? 'Modus beenden' : 'Widget Entfernen');
    });
  
    // Remove widget
    $(document).on('click', '.widget-remove-btn', function () {
      $(this).closest('.widget').remove();
      saveWidgetState();
    });
  
    // Initialize draggable and resizable widgets
    function initDraggableResizable() {
      $('.widget').draggable({
        handle: '.widget-drag-handle',
        containment: '#dashboardContainer',
        stop: saveWidgetState,
      }).resizable({
        stop: saveWidgetState,
        minWidth: 150,
        minHeight: 100,
      });
    }
  
    // Add a new widget
    function addWidget(type) {
      const widgetHtml = `
        <div class="widget card" data-widget="${type}">
          <div class="widget-drag-handle">
            <span class="badge text-bg-secondary">Verschieben</span>
          </div>
          <div class="card-body">
            <h5 class="card-title">${type.charAt(0).toUpperCase() + type.slice(1)}</h5>
            <p class="card-text display-5">${getWidgetContent(type)}</p>
            <button class="btn btn-sm btn-danger widget-remove-btn">X</button>
          </div>
        </div>
      `;
      $('#dashboardContainer').append(widgetHtml);
      initDraggableResizable();
      saveWidgetState();
    }
  
    // Get widget content based on type
    function getWidgetContent(type) {
      const data = {
        mitglieder: '{{ anzahl_mitglieder }}',
        events: '{{ anzahl_events }}',
        notizen: '{{ anzahl_notizen }}',
        saldo: '{{ saldo }} €',
        einnahmen-ausgaben: '<canvas id="einnahmenAusgabenChart"></canvas>',
        mitgliederstatus: '<canvas id="mitgliederStatusChart"></canvas>',
      };
      return data[type] || 'No data available';
    }
  
    // Save widget state to localStorage
    function saveWidgetState() {
      const widgetStates = [];
      $('.widget').each(function () {
        const $widget = $(this);
        const state = {
          type: $widget.data('widget'),
          top: ($widget.position().top / $('#dashboardContainer').height()) * 100,
          left: ($widget.position().left / $('#dashboardContainer').width()) * 100,
          width: ($widget.width() / $('#dashboardContainer').width()) * 100,
          height: ($widget.height() / $('#dashboardContainer').height()) * 100,
        };
        widgetStates.push(state);
      });
      localStorage.setItem('widgetStates', JSON.stringify(widgetStates));
    }
  
    // Load widget state from localStorage
    function loadWidgetState() {
      const savedStates = JSON.parse(localStorage.getItem('widgetStates')) || [];
      savedStates.forEach(state => {
        addWidget(state.type);
        const $widget = $(`[data-widget="${state.type}"]`);
        $widget.css({
          top: `${state.top}%`,
          left: `${state.left}%`,
          width: `${state.width}%`,
          height: `${state.height}%`,
        });
      });
    }
  
    // Initialize the dashboard
    function initDashboard() {
      loadWidgetState();
      initDraggableResizable();
    }
  });