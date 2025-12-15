/**
 * Hauptlogik für den Schuldienstplan
 * Enthält Konfiguration, Rotationslogik, UI-Rendering und Admin-Funktionen.
 */

// ==========================================
// 1. KONFIGURATION & DATEN
// ==========================================

const CONFIG = {
    startDate: "2026-01-12", // Startdatum (Montag)
    endDate: "2026-07-02",   // Enddatum
    adminHash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // "password"
    duties: [
        { id: "tafel", name: "Tafel", icon: "🧽", rule: "Nach jeder Stunde & am Ende des Tages wischen." },
        { id: "fegen", name: "Fegen", icon: "🧹", rule: "Klassenraum am Ende des Tages fegen." },
        { id: "austeilen", name: "Austeilen", icon: "📄", rule: "Arbeitsblätter & Materialien verteilen." },
        { id: "supervisor", name: "Supervisor", icon: "🦅", rule: "Kontrolle aller Dienste auf Sauberkeit.", hasCheck: true },
        { id: "handy", name: "Handy Hotel", icon: "📱", rule: "Handys morgens einsammeln & wegschließen.", dailyCheck: true },
        { id: "muell", name: "Müll", icon: "🗑️", rule: "Müll trennen & Eimer rausbringen." }
    ],
    defaultStudents: [
        "Mia Müller", "Ben Schmidt", "Emma Schneider", "Lukas Fischer",
        "Sofia Weber", "Leon Meyer", "Hannah Wagner", "Finn Becker",
        "Anna Schulz", "Elias Hoffmann", "Emilia Schäfer", "Jonas Koch",
        "Lina Bauer", "Noah Richter", "Marie Klein", "Paul Wolf",
        "Lena Schröder", "Luis Neumann", "Lea Schwarz", "Felix Zimmermann",
        "Amelie Braun", "Maximilian Krüger", "Clara Hofman", "Julian Hartmann"
    ]
};

let state = {
    students: [],
    sickLog: {},
    checklist: {},
    currentWeekOffset: 0
};

// ==========================================
// 2. INITIALISIERUNG
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 1. Events binden (WICHTIG: Zuerst binden, dann Logik starten)
    setupEventListeners();
    
    // 2. Status laden
    loadState();
    
    // 3. Entscheiden, was angezeigt wird
    if (!state.students || state.students.length === 0) {
        console.log("Keine Schüler gefunden. Starte Setup...");
        showSetupModal(); // Modal öffnen
    } else {
        initApp();
    }
});

function initApp() {
    jumpToToday();
}

// ==========================================
// 3. LOGIK & ROTATION
// ==========================================

function getRosterForWeek(weekOffset) {
    const totalStudents = state.students.length;
    if (totalStudents === 0) return { assignments: [], pauseGroup: [] };

    const shift = (weekOffset * 2) % totalStudents;
    let rotatedStudents = new Array(totalStudents);

    for (let i = 0; i < totalStudents; i++) {
        let studentIndex = (i + shift) % totalStudents;
        rotatedStudents[i] = state.students[studentIndex];
    }

    const assignments = [];
    let currentIndex = 0;

    CONFIG.duties.forEach(duty => {
        if (currentIndex + 1 < rotatedStudents.length) {
            assignments.push({
                type: 'active',
                duty: duty,
                pair: [rotatedStudents[currentIndex], rotatedStudents[currentIndex + 1]]
            });
            currentIndex += 2;
        }
    });

    const pauseGroup = [];
    while (currentIndex < totalStudents) {
        pauseGroup.push(rotatedStudents[currentIndex]);
        currentIndex++;
    }

    return { assignments, pauseGroup };
}

function getWeekId(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
}

// ==========================================
// 4. UI RENDERING
// ==========================================

function renderRoster() {
    // Sicherheitscheck: Wenn keine Schüler da sind, nichts rendern
    if (!state.students || state.students.length === 0) {
        // Falls wir hier landen, aber keine Schüler haben -> Setup zeigen
        showSetupModal(); 
        return;
    }

    const startDate = new Date(CONFIG.startDate);
    const currentDisplayDate = new Date(startDate);
    currentDisplayDate.setDate(startDate.getDate() + (state.currentWeekOffset * 7));

    const endDate = new Date(CONFIG.endDate);
    
    const monday = new Date(currentDisplayDate);
    const friday = new Date(currentDisplayDate);
    friday.setDate(monday.getDate() + 4);
    
    const dateStr = `${formatDate(monday)} - ${formatDate(friday)}`;
    const dateDisplay = document.getElementById('date-display');
    if(dateDisplay) {
        dateDisplay.textContent = dateStr;
        dateDisplay.dataset.weekId = getWeekId(monday);
    }

    const prevBtn = document.getElementById('prev-week-btn');
    const nextBtn = document.getElementById('next-week-btn');
    if (prevBtn) prevBtn.disabled = monday <= startDate;
    if (nextBtn) nextBtn.disabled = friday >= endDate;

    const pauseSection = document.getElementById('pause-section');
    const grid = document.getElementById('roster-grid');
    if (!grid) return; // Fail-safe

    if (monday > endDate) {
        grid.innerHTML = '<div class="duty-card"><h3>Dienstplan beendet! 🎉</h3></div>';
        if(pauseSection) pauseSection.style.display = 'none';
        return;
    } else {
        if(pauseSection) pauseSection.style.display = 'block';
    }

    const roster = getRosterForWeek(state.currentWeekOffset);
    const weekId = getWeekId(monday);

    grid.innerHTML = '';

    roster.assignments.forEach(assign => {
        const card = document.createElement('div');
        card.className = 'duty-card animate-in';
        card.dataset.duty = assign.duty.name;

        const p1 = formatStudentHTML(assign.pair[0], weekId);
        const p2 = formatStudentHTML(assign.pair[1], weekId);

        let checkHtml = '';
        
        if (assign.duty.hasCheck) {
            const isChecked = state.checklist[`${weekId}-${assign.duty.id}`] || false;
            checkHtml = `
                <label class="task-check ${isChecked ? 'completed' : ''}">
                    <input type="checkbox" onchange="toggleCheck('${weekId}', '${assign.duty.id}', this)" ${isChecked ? 'checked' : ''}>
                    ${isChecked ? 'Dienste kontrolliert' : 'Kontrolle bestätigen'}
                </label>
            `;
        }

        if (assign.duty.dailyCheck) {
            const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
            checkHtml += '<div style="display:flex; gap:5px; margin-top:10px; justify-content:center;">';
            days.forEach((day, idx) => {
                const key = `${weekId}-${assign.duty.id}-${idx}`;
                const isChecked = state.checklist[key] || false;
                checkHtml += `
                    <label style="display:flex; flex-direction:column; font-size:0.7rem; align-items:center;">
                        ${day}
                        <input type="checkbox" onchange="toggleCheck('${weekId}', '${assign.duty.id}-${idx}', this)" ${isChecked ? 'checked' : ''}>
                    </label>
                `;
            });
            checkHtml += '</div>';
        }

        card.innerHTML = `
            <div class="duty-icon">${assign.duty.icon}</div>
            <div class="duty-title">${assign.duty.name}</div>
            <div class="duty-rule">${assign.duty.rule}</div>
            <div class="student-pair">
                <span class="student-name">${p1}</span>
                <span class="student-name">${p2}</span>
            </div>
            ${checkHtml}
        `;
        grid.appendChild(card);
    });

    const pauseList = document.getElementById('pause-list');
    if (pauseList) {
        pauseList.innerHTML = '';
        roster.pauseGroup.forEach((student, index) => {
            const span = document.createElement('span');
            span.className = 'pause-name';
            const sickEntry = getSickEntry(student.name, weekId);
            if (sickEntry) span.classList.add('sick-student');
            span.textContent = student.name;
            if (index < 2) span.title = "Nächste Woche: Tafel";
            pauseList.appendChild(span);
        });
    }
}

function formatStudentHTML(studentObj, weekId) {
    if (!studentObj) return "???";
    const sickEntry = getSickEntry(studentObj.name, weekId);
    if (sickEntry) {
        let html = `<span class="sick-student">${studentObj.name}</span>`;
        if (sickEntry.replacement) html += `<span class="sick-replacement">↳ Ersatz: ${sickEntry.replacement}</span>`;
        return html;
    }
    return studentObj.name;
}

function formatDate(date) {
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ==========================================
// 5. INTERAKTIONEN & EVENTS
// ==========================================

function setupEventListeners() {
    const nextBtn = document.getElementById('next-week-btn');
    const prevBtn = document.getElementById('prev-week-btn');
    const todayBtn = document.getElementById('today-btn');
    
    if (nextBtn) nextBtn.addEventListener('click', () => changeWeek(1));
    if (prevBtn) prevBtn.addEventListener('click', () => changeWeek(-1));
    if (todayBtn) todayBtn.addEventListener('click', jumpToToday);

    // Admin Modal
    const adminToggle = document.getElementById('admin-toggle-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeModal = document.getElementById('close-modal');

    if (adminToggle) {
        adminToggle.addEventListener('click', () => {
            adminModal.classList.remove('hidden');
            document.getElementById('admin-login').style.display = 'block';
            document.getElementById('admin-panel').classList.add('hidden');
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            adminModal.classList.add('hidden');
        });
    }

    // Login & Setup Buttons
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    const markSickBtn = document.getElementById('mark-sick-btn');
    if (markSickBtn) markSickBtn.addEventListener('click', markStudentSick);

    const editBtn = document.getElementById('edit-students-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            adminModal.classList.add('hidden');
            showSetupModal(true);
        });
    }

    const resetBtn = document.getElementById('reset-app-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetApp);
    
    const dlBtn = document.getElementById('download-backup-btn');
    if (dlBtn) dlBtn.addEventListener('click', downloadBackup);

    const upInput = document.getElementById('upload-backup-input');
    if (upInput) upInput.addEventListener('change', uploadBackup);

    // WICHTIG: Setup Modal Buttons müssen existieren
    const loadDefBtn = document.getElementById('load-default-btn');
    const saveStdBtn = document.getElementById('save-students-btn');

    if (loadDefBtn) {
        loadDefBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Verhindert Form-Submit Verhalten
            const area = document.getElementById('student-input-area');
            if (area) area.value = CONFIG.defaultStudents.join('\n');
        });
    } else {
        console.error("Button 'load-default-btn' nicht im HTML gefunden!");
    }
    
    if (saveStdBtn) {
        saveStdBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveStudentsFromInput();
        });
    } else {
        console.error("Button 'save-students-btn' nicht im HTML gefunden!");
    }
}

function changeWeek(offset) {
    state.currentWeekOffset += offset;
    renderRoster();
}

function jumpToToday() {
    const start = new Date(CONFIG.startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const diffWeeks = Math.floor(diffDays / 7);

    state.currentWeekOffset = (now < start) ? 0 : diffWeeks;
    renderRoster();
}

window.toggleCheck = function(weekId, taskId, checkbox) {
    const key = `${weekId}-${taskId}`;
    state.checklist[key] = checkbox.checked;
    saveState();
    const label = checkbox.parentElement;
    if (label.classList.contains('task-check')) {
        label.classList.toggle('completed', checkbox.checked);
        label.childNodes[2].textContent = checkbox.checked ? " Dienste kontrolliert" : " Kontrolle bestätigen";
    }
};

// ==========================================
// 6. ADMIN & HELPER
// ==========================================

async function handleLogin() {
    const pwd = document.getElementById('admin-password').value;
    const hash = await sha256(pwd);
    if (hash === CONFIG.adminHash) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').classList.remove('hidden');
        populateStudentSelector();
    } else {
        alert("Falsches Passwort!");
    }
}

function populateStudentSelector() {
    const select = document.getElementById('student-selector');
    if (!select) return;
    select.innerHTML = '<option value="">Schüler auswählen...</option>';
    const sorted = [...state.students].sort((a,b) => a.name.localeCompare(b.name));
    sorted.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        select.appendChild(opt);
    });
}

function markStudentSick() {
    const select = document.getElementById('student-selector');
    const name = select.value;
    if (!name) return;
    const dateDisplay = document.getElementById('date-display');
    if (!dateDisplay) return;
    const weekId = dateDisplay.dataset.weekId;
    
    const roster = getRosterForWeek(state.currentWeekOffset);
    const replacement = roster.pauseGroup.length > 0 ? roster.pauseGroup[0].name : "Lehrer fragen";

    if (!state.sickLog[weekId]) state.sickLog[weekId] = [];
    
    const exists = state.sickLog[weekId].find(e => e.name === name);
    if (!exists) {
        state.sickLog[weekId].push({ name, replacement, date: new Date().toISOString() });
        saveState();
        alert(`${name} als krank gemeldet. Ersatz: ${replacement}`);
        renderRoster();
    } else {
        alert("Bereits gemeldet.");
    }
}

function getSickEntry(name, weekId) {
    if (!state.sickLog[weekId]) return null;
    return state.sickLog[weekId].find(e => e.name === name);
}

// ==========================================
// 7. SETUP MODAL (WICHTIGSTE FUNKTIONEN)
// ==========================================

function showSetupModal(isEdit = false) {
    console.log("Öffne Setup Modal...");
    const modal = document.getElementById('setup-modal');
    if (modal) {
        modal.classList.remove('hidden'); // CSS Klasse entfernen
        modal.style.display = 'flex'; // Sicherstellen, dass es sichtbar ist
        
        if (isEdit) {
            const names = state.students.map(s => s.name).join('\n');
            document.getElementById('student-input-area').value = names;
        }
    } else {
        console.error("Setup Modal HTML Element nicht gefunden!");
    }
}

function saveStudentsFromInput() {
    console.log("Speichere Schüler...");
    const area = document.getElementById('student-input-area');
    if (!area) return;
    
    const text = area.value;
    const lines = text.split(/[\r\n,]+/).map(s => s.trim()).filter(s => s.length > 0);

    if (lines.length !== 24) {
        if (!confirm(`Es wurden ${lines.length} Namen erkannt. Das System benötigt idealerweise 24 Schüler. Trotzdem fortfahren?`)) {
            return;
        }
    }

    state.students = lines.map((name, index) => ({ id: index, name: name }));
    state.currentWeekOffset = 0;
    state.sickLog = {};
    state.checklist = {};
    
    saveState();
    
    // Modal schließen
    const modal = document.getElementById('setup-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none'; // Zurücksetzen für CSS-Klassen-Logik
    
    initApp();
}

function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const dlAnchor = document.createElement('a');
    dlAnchor.href = dataStr;
    dlAnchor.download = "dienstplan_backup.json";
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function uploadBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (json.students) {
                state = json;
                saveState();
                renderRoster();
                alert("Backup geladen!");
            }
        } catch(err) { alert("Fehler beim Laden."); }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function resetApp() {
    if (confirm("Alles löschen?")) {
        localStorage.removeItem('dienstplanState');
        location.reload();
    }
}

function saveState() {
    localStorage.setItem('dienstplanState', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('dienstplanState');
    if (saved) {
        try { state = JSON.parse(saved); } catch (e) { console.error(e); }
    }
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(me
