/**
 * Hauptlogik für den Schuldienstplan (FIXED VERSION)
 */

// ==========================================
// 1. KONFIGURATION & DATEN
// ==========================================

const CONFIG = {
    startDate: "2026-01-12",
    endDate: "2026-07-02",
    adminHash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // "password"
    duties: [
        { id: "tafel", name: "Tafel", icon: "🧽", rule: "Nach jeder Stunde & am Ende des Tages wischen." },
        { id: "fegen", name: "Fegen", icon: "🧹", rule: "Klassenraum am Ende des Tages fegen." },
        { id: "austeilen", name: "Austeilen", icon: "📄", rule: "Arbeitsblätter & Materialien verteilen." },
        { id: "supervisor", name: "Supervisor", icon: "🦅", rule: "Kontrolle aller Dienste auf Sauberkeit.", hasCheck: true },
        { id: "handy", name: "Handy Hotel", icon: "📱", rule: "Handys morgens einsammeln & wegschließen.", dailyCheck: true },
        { id: "muell", name: "Müll", icon: "🗑️", rule: "Müll trennen & Eimer rausbringen." }
    ],
    // Die Beispiel-Liste
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
    console.log("App gestartet...");
    
    // 1. Zuerst Buttons aktivieren (damit 'Beispiel laden' geht)
    setupEventListeners();
    
    // 2. Gespeicherte Daten laden
    loadState();
    
    // 3. Prüfen: Brauchen wir das Setup?
    if (!state.students || state.students.length === 0) {
        console.log("Keine Schülerdaten. Öffne Setup...");
        const setupModal = document.getElementById('setup-modal');
        if (setupModal) {
            setupModal.classList.remove('hidden');
        }
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
    if (!state.students || state.students.length === 0) return;

    const startDate = new Date(CONFIG.startDate);
    const currentDisplayDate = new Date(startDate);
    currentDisplayDate.setDate(startDate.getDate() + (state.currentWeekOffset * 7));

    const endDate = new Date(CONFIG.endDate);
    const monday = new Date(currentDisplayDate);
    const friday = new Date(currentDisplayDate);
    friday.setDate(monday.getDate() + 4);
    
    const dateDisplay = document.getElementById('date-display');
    if (dateDisplay) {
        dateDisplay.textContent = `${formatDate(monday)} - ${formatDate(friday)}`;
        dateDisplay.dataset.weekId = getWeekId(monday);
    }

    // Navigation Buttons Update
    const prevBtn = document.getElementById('prev-week-btn');
    const nextBtn = document.getElementById('next-week-btn');
    if (prevBtn) prevBtn.disabled = monday <= startDate;
    if (nextBtn) nextBtn.disabled = friday >= endDate;

    const grid = document.getElementById('roster-grid');
    if (grid) {
        if (monday > endDate) {
            grid.innerHTML = '<div class="duty-card"><h3>Dienstplan beendet! 🎉</h3></div>';
            document.getElementById('pause-section').style.display = 'none';
            return;
        } else {
            document.getElementById('pause-section').style.display = 'block';
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
            // Checkbox Logik
            if (assign.duty.hasCheck) {
                const isChecked = state.checklist[`${weekId}-${assign.duty.id}`] || false;
                checkHtml = `<label class="task-check ${isChecked ? 'completed' : ''}"><input type="checkbox" onchange="toggleCheck('${weekId}', '${assign.duty.id}', this)" ${isChecked ? 'checked' : ''}>${isChecked ? 'Dienste kontrolliert' : 'Kontrolle bestätigen'}</label>`;
            }
            if (assign.duty.dailyCheck) {
                checkHtml += '<div style="display:flex; gap:5px; margin-top:10px; justify-content:center;">';
                ['Mo', 'Di', 'Mi', 'Do', 'Fr'].forEach((day, idx) => {
                    const key = `${weekId}-${assign.duty.id}-${idx}`;
                    const isChecked = state.checklist[key] || false;
                    checkHtml += `<label style="display:flex; flex-direction:column; font-size:0.7rem; align-items:center;">${day}<input type="checkbox" onchange="toggleCheck('${weekId}', '${assign.duty.id}-${idx}', this)" ${isChecked ? 'checked' : ''}></label>`;
                });
                checkHtml += '</div>';
            }

            card.innerHTML = `<div class="duty-icon">${assign.duty.icon}</div><div class="duty-title">${assign.duty.name}</div><div class="duty-rule">${assign.duty.rule}</div><div class="student-pair"><span class="student-name">${p1}</span><span class="student-name">${p2}</span></div>${checkHtml}`;
            grid.appendChild(card);
        });

        const pauseList = document.getElementById('pause-list');
        if (pauseList) {
            pauseList.innerHTML = '';
            roster.pauseGroup.forEach((student, index) => {
                const span = document.createElement('span');
                span.className = 'pause-name';
                if (getSickEntry(student.name, weekId)) span.classList.add('sick-student');
                span.textContent = student.name;
                if (index < 2) span.title = "Nächste Woche: Tafel";
                pauseList.appendChild(span);
            });
        }
    }
}

function formatStudentHTML(studentObj, weekId) {
    if (!studentObj) return "???";
    const sickEntry = getSickEntry(studentObj.name, weekId);
    if (sickEntry) {
        return `<span class="sick-student">${studentObj.name}</span>` + (sickEntry.replacement ? `<span class="sick-replacement">↳ Ersatz: ${sickEntry.replacement}</span>` : '');
    }
    return studentObj.name;
}

function formatDate(date) {
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ==========================================
// 5. EVENT LISTENERS (HIER WAR DAS PROBLEM)
// ==========================================

function setupEventListeners() {
    // 1. Beispiel laden Button
    const loadDefaultBtn = document.getElementById('load-default-btn');
    if (loadDefaultBtn) {
        loadDefaultBtn.addEventListener('click', (e) => {
            console.log("Beispiel laden geklickt");
            const textArea = document.getElementById('student-input-area');
            if (textArea) {
                textArea.value = CONFIG.defaultStudents.join('\n');
            } else {
                alert("Fehler: Eingabefeld nicht gefunden.");
            }
        });
    }

    // 2. Speichern Button im Setup
    const saveStudentsBtn = document.getElementById('save-students-btn');
    if (saveStudentsBtn) {
        saveStudentsBtn.addEventListener('click', () => {
            console.log("Speichern geklickt");
            saveStudentsFromInput();
        });
    }

    // 3. Navigation
    const nextBtn = document.getElementById('next-week-btn');
    const prevBtn = document.getElementById('prev-week-btn');
    const todayBtn = document.getElementById('today-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => changeWeek(1));
    if (prevBtn) prevBtn.addEventListener('click', () => changeWeek(-1));
    if (todayBtn) todayBtn.addEventListener('click', jumpToToday);

    // 4. Admin Toggle
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
        closeModal.addEventListener('click', () => adminModal.classList.add('hidden'));
    }

    // 5. Login
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    // 6. Admin Aktionen
    const markSickBtn = document.getElementById('mark-sick-btn');
    if (markSickBtn) markSickBtn.addEventListener('click', markStudentSick);

    const editStudentsBtn = document.getElementById('edit-students-btn');
    if (editStudentsBtn) {
        editStudentsBtn.addEventListener('click', () => {
            adminModal.classList.add('hidden');
            const setupModal = document.getElementById('setup-modal');
            if (setupModal) setupModal.classList.remove('hidden');
            // Namen in Textarea laden
            const names = state.students.map(s => s.name).join('\n');
            document.getElementById('student-input-area').value = names;
        });
    }

    const resetAppBtn = document.getElementById('reset-app-btn');
    if (resetAppBtn) resetAppBtn.addEventListener('click', resetApp);
    
    const dlBtn = document.getElementById('download-backup-btn');
    if (dlBtn) dlBtn.addEventListener('click', downloadBackup);
    
    const upInput = document.getElementById('upload-backup-input');
    if (upInput) upInput.addEventListener('change', uploadBackup);
}

// ==========================================
// 6. HILFSFUNKTIONEN
// ==========================================

function changeWeek(offset) {
    state.currentWeekOffset += offset;
    renderRoster();
}

function jumpToToday() {
    const start = new Date(CONFIG.startDate);
    const now = new Date();
    const diffWeeks = Math.floor(Math.ceil(Math.abs(now - start) / (86400000)) / 7);
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

function saveStudentsFromInput() {
    const area = document.getElementById('student-input-area');
    if (!area) return;
    
    const text = area.value;
    const lines = text.split(/[\r\n,]+/).map(s => s.trim()).filter(s => s.length > 0);

    if (lines.length === 0) {
        alert("Bitte gib mindestens einen Namen ein.");
        return;
    }

    if (lines.length !== 24) {
        if (!confirm(`Du hast ${lines.length} Namen. Ideal sind 24. Trotzdem speichern?`)) return;
    }

    state.students = lines.map((name, index) => ({ id: index, name: name }));
    state.currentWeekOffset = 0;
    saveState();

    // Modal schließen mit CSS Klasse
    const modal = document.getElementById('setup-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    initApp();
}

// Admin & Backup (Gekürzt für Übersicht, Logik bleibt gleich)
async function handleLogin() {
    const pwd = document.getElementById('admin-password').value;
    const hash = await sha256(pwd);
    if (hash === CONFIG.adminHash) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').classList.remove('hidden');
        populateStudentSelector();
    } else { alert("Falsches Passwort!"); }
}

function populateStudentSelector() {
    const select = document.getElementById('student-selector');
    select.innerHTML = '<option value="">Schüler auswählen...</option>';
    state.students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        select.appendChild(opt);
    });
}

function markStudentSick() {
    const name = document.getElementById('student-selector').value;
    if (!name) return;
    const weekId = document.getElementById('date-display').dataset.weekId;
    if (!state.sickLog[weekId]) state.sickLog[weekId] = [];
    state.sickLog[weekId].push({ name, replacement: "Ersatz", date: new Date().toISOString() });
    saveState();
    renderRoster();
    alert("Gespeichert");
}

function getSickEntry(name, weekId) {
    return state.sickLog[weekId] ? state.sickLog[weekId].find(e => e.name === name) : null;
}

function resetApp() {
    if (confirm("Wirklich alles löschen?")) {
        localStorage.removeItem('dienstplanState');
        location.reload();
    }
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
        try { state = JSON.parse(e.target.result); saveState(); renderRoster(); alert("Backup geladen!"); } 
        catch(err) { alert("Fehler!"); }
    };
    reader.readAsText(file);
}

function saveState() { localStorage.setItem('dienstplanState', JSON.stringify(state)); }
function loadState() { const s = localStorage.getItem('dienstplanState'); if(s) state = JSON.parse(s); }
async function sha256(m) { const b = new TextEncoder().encode(m); const h = await crypto.subtle.digest('SHA-256', b); return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2,'0')).join(''); }
