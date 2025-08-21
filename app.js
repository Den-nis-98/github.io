// app.js
let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

const STORAGE_KEY = 'workShifts';
let currentDate = new Date();
let shifts = loadShifts();
let selectedDate = null;

// Элементы DOM
const calendarEl = document.getElementById('calendar');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const modal = document.getElementById('shift-modal');
const selectedDateEl = document.getElementById('selected-date');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const saveShiftBtn = document.getElementById('save-shift');
const deleteShiftBtn = document.getElementById('delete-shift');
const cancelShiftBtn = document.getElementById('cancel-shift');
const closeBtn = document.querySelector('.close');
const shiftsCountEl = document.getElementById('shifts-count');
const totalHoursEl = document.getElementById('total-hours');

// Инициализация
renderCalendar();
updateStats();
setupEventListeners();

function setupEventListeners() {
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    
    saveShiftBtn.addEventListener('click', saveShift);
    deleteShiftBtn.addEventListener('click', deleteShift);
    cancelShiftBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    currentMonthEl.textContent = currentDate.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric'
    });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    
    calendarEl.innerHTML = '';
    
    // Дни из предыдущего месяца
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const date = new Date(year, month - 1, day);
        addDayToCalendar(date, true);
    }
    
    // Дни текущего месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        addDayToCalendar(date, false);
    }
    
    // Дни следующего месяца
    const totalCells = 42; // 6 недель
    const remainingCells = totalCells - (startDay + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        const date = new Date(year, month + 1, day);
        addDayToCalendar(date, true);
    }
}

function addDayToCalendar(date, isOtherMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    
    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }
    
    // Помечаем выходные
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        dayEl.classList.add('weekend');
    }
    
    const dayNumber = date.getDate();
    const dateKey = formatDateKey(date);
    const shift = shifts[dateKey];
    
    if (shift) {
        dayEl.classList.add('has-shift');
        dayEl.innerHTML = `
            <div class="day-number">${dayNumber}</div>
            <div class="day-shift">${shift.start}-${shift.end}</div>
        `;
    } else {
        dayEl.innerHTML = `<div class="day-number">${dayNumber}</div>`;
    }
    
    dayEl.addEventListener('click', () => openModal(date));
    calendarEl.appendChild(dayEl);
}

function openModal(date) {
    selectedDate = date;
    const dateKey = formatDateKey(date);
    const shift = shifts[dateKey];
    
    selectedDateEl.textContent = date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    if (shift) {
        startTimeInput.value = shift.start;
        endTimeInput.value = shift.end;
        deleteShiftBtn.style.display = 'block';
    } else {
        startTimeInput.value = '09:00';
        endTimeInput.value = '18:00';
        deleteShiftBtn.style.display = 'none';
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
    selectedDate = null;
}

function saveShift() {
    if (!selectedDate) return;
    
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    
    if (!startTime || !endTime) {
        alert('Пожалуйста, укажите время начала и окончания смены');
        return;
    }
    
    const dateKey = formatDateKey(selectedDate);
    shifts[dateKey] = { start: startTime, end: endTime };
    
    saveShifts();
    renderCalendar();
    updateStats();
    closeModal();
}

function deleteShift() {
    if (!selectedDate) return;
    
    const dateKey = formatDateKey(selectedDate);
    delete shifts[dateKey];
    
    saveShifts();
    renderCalendar();
    updateStats();
    closeModal();
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
    updateStats();
}

function updateStats() {
    const currentShifts = getShiftsForCurrentMonth();
    const totalHours = calculateTotalHours(currentShifts);
    
    shiftsCountEl.textContent = currentShifts.length;
    totalHoursEl.textContent = totalHours;
}

function getShiftsForCurrentMonth() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return Object.entries(shifts).filter(([dateKey]) => {
        const [y, m] = dateKey.split('-').map(Number);
        return y === year && m === month + 1;
    }).map(([_, shift]) => shift);
}

function calculateTotalHours(shifts) {
    return shifts.reduce((total, shift) => {
        const [startHours, startMinutes] = shift.start.split(':').map(Number);
        const [endHours, endMinutes] = shift.end.split(':').map(Number);
        
        let hours = endHours - startHours;
        let minutes = endMinutes - startMinutes;
        
        if (minutes < 0) {
            hours--;
            minutes += 60;
        }
        
        return total + hours + (minutes / 60);
    }, 0).toFixed(1);
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function loadShifts() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

function saveShifts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
}
