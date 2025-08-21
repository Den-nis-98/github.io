class ScheduleApp {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.setupTheme();
        this.loadUserData();
        this.loadSchedule();
    }

    initializeElements() {
        this.elements = {
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            scheduleList: document.getElementById('schedule-list'),
            refreshBtn: document.getElementById('refresh-btn'),
            exportBtn: document.getElementById('export-btn'),
            themeBtn: document.getElementById('theme-btn'),
            periodSelect: document.getElementById('period-select'),
            userName: document.getElementById('user-name'),
            totalShifts: document.getElementById('total-shifts'),
            hoursCount: document.getElementById('hours-count')
        };
    }

    bindEvents() {
        this.elements.refreshBtn.addEventListener('click', () => this.loadSchedule());
        this.elements.exportBtn.addEventListener('click', () => this.exportSchedule());
        this.elements.themeBtn.addEventListener('click', () => this.toggleTheme());
        this.elements.periodSelect.addEventListener('change', () => this.loadSchedule());
        
        this.tg.onEvent('themeChanged', () => this.setupTheme());
    }

    setupTheme() {
        const isDark = this.tg.colorScheme === 'dark';
        this.elements.themeBtn.textContent = isDark ? '☀️' : '🌙';
        document.body.classList.toggle('dark-theme', isDark);
    }

    toggleTheme() {
        this.tg.showPopup({
            title: 'Смена темы',
            message: 'Измените тему в настройках Telegram',
            buttons: [{ type: 'ok' }]
        });
    }

    loadUserData() {
        const user = this.tg.initDataUnsafe.user;
        if (user) {
            const userName = user.first_name || user.username || 'Пользователь';
            this.elements.userName.textContent = userName;
        }
    }

    async loadSchedule() {
        this.showLoading();
        this.hideError();

        try {
            // Имитация загрузки данных с сервера
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const period = this.elements.periodSelect.value;
            const scheduleData = this.generateFakeSchedule(period);
            
            this.displaySchedule(scheduleData);
            this.updateStats(scheduleData);
            
        } catch (error) {
            this.showError('Ошибка загрузки графика');
        } finally {
            this.hideLoading();
        }
    }

    generateFakeSchedule(period) {
        const shifts = [];
        const now = new Date();
        const daysInPeriod = period === 'week' ? 7 : period === 'month' ? 30 : 90;

        for (let i = 0; i < daysInPeriod; i++) {
            if (Math.random() > 0.7) { // 30% chance of having a shift
                const date = new Date(now);
                date.setDate(now.getDate() + i);
                
                const startHour = 8 + Math.floor(Math.random() * 4);
                const duration = 4 + Math.floor(Math.random() * 8);
                
                shifts.push({
                    id: i + 1,
                    date: date.toISOString().split('T')[0],
                    start: `${startHour}:00`,
                    end: `${startHour + duration}:00`,
                    place: ['Главный офис', 'Филиал №1', 'Удалённо'][Math.floor(Math.random() * 3)],
                    confirmed: Math.random() > 0.3
                });
            }
        }

        return shifts;
    }

    displaySchedule(schedule) {
        this.elements.scheduleList.innerHTML = '';

        if (schedule.length === 0) {
            this.elements.scheduleList.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 3em;">📅</div>
                    <h3>Смен не найдено</h3>
                    <p>На выбранный период смен не запланировано</p>
                </div>
            `;
            return;
        }

        schedule.forEach(shift => {
            const shiftElement = this.createShiftElement(shift);
            this.elements.scheduleList.appendChild(shiftElement);
        });
    }

    createShiftElement(shift) {
        const div = document.createElement('div');
        div.className = 'shift-card';
        
        const date = new Date(shift.date).toLocaleDateString('ru-RU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });

        div.innerHTML = `
            <div class="shift-header">
                <div class="shift-date">${date}</div>
                <div class="shift-status ${shift.confirmed ? 'status-confirmed' : 'status-pending'}">
                    ${shift.confirmed ? '✓ Подтверждена' : '⏳ Ожидание'}
                </div>
            </div>
            
            <div class="shift-details">
                <div class="detail-item">
                    <span>🕐</span>
                    <span>${shift.start} - ${shift.end}</span>
                </div>
                <div class="detail-item">
                    <span>📍</span>
                    <span>${shift.place}</span>
                </div>
            </div>
        `;

        return div;
    }

    updateStats(schedule) {
        this.elements.totalShifts.textContent = schedule.length;
        
        const totalHours = schedule.reduce((sum, shift) => {
            const start = parseInt(shift.start.split(':')[0]);
            const end = parseInt(shift.end.split(':')[0]);
            return sum + (end - start);
        }, 0);
        
        this.elements.hoursCount.textContent = totalHours;
    }

    exportSchedule() {
        this.tg.showPopup({
            title: 'Экспорт графика',
            message: 'Функция экспорта будет доступна в следующем обновлении',
            buttons: [{ type: 'ok' }]
        });
    }

    showLoading() {
        this.elements.loading.style.display = 'block';
        this.elements.scheduleList.style.opacity = '0.5';
    }

    hideLoading() {
        this.elements.loading.style.display = 'none';
        this.elements.scheduleList.style.opacity = '1';
    }

    showError(message) {
        this.elements.error.textContent = message;
        this.elements.error.style.display = 'block';
    }

    hideError() {
        this.elements.error.style.display = 'none';
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    const app = new ScheduleApp();
    
    // Инициализация Telegram Web App
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.enableClosingConfirmation();
    tg.ready();
    
    console.log('Schedule App initialized successfully');
});