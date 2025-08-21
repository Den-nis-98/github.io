class ScheduleApp {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.API_BASE = 'https://your-backend.herokuapp.com/api';
        this.init();
    }

    // ... остальные методы ...

    async loadSchedule() {
        this.showLoading();
        this.hideError();

        try {
            const userId = this.tg.initDataUnsafe.user?.id;
            const period = this.elements.periodSelect.value;
            
            const response = await fetch(`${this.API_BASE}/schedule/${userId}?period=${period}`);
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            
            if (result.success) {
                this.displaySchedule(result.data);
                this.updateStats(result.data);
                this.displayWorkRecords(result.workRecords);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.showError('Ошибка загрузки данных');
        } finally {
            this.hideLoading();
        }
    }

    displayWorkRecords(records) {
        const recordsContainer = document.getElementById('work-records');
        if (!recordsContainer) return;

        if (records.length === 0) {
            recordsContainer.innerHTML = '<p>Записей о работе пока нет</p>';
            return;
        }

        recordsContainer.innerHTML = records.map(record => `
            <div class="record-card">
                <div class="record-date">${record.date}</div>
                <div class="record-time">${record.startTime} - ${record.endTime}</div>
                <div class="record-hours">⏱ ${record.hours}ч ${record.minutes}м</div>
                ${record.notes ? `<div class="record-notes">📝 ${record.notes}</div>` : ''}
            </div>
        `).join('');
    }

    async recordHoursManually() {
        const result = await this.tg.showPopup({
            title: 'Запись часов',
            message: 'Введите время начала и окончания:',
            buttons: [
                { type: 'default', text: '09:00 18:00' },
                { type: 'default', text: '10:00 19:00' },
                { type: 'cancel', text: 'Отмена' }
            ]
        });

        if (result.button_id !== 'cancel') {
            const [startTime, endTime] = result.button_text.split(' ');
            await this.saveWorkRecord(startTime, endTime);
        }
    }

    async saveWorkRecord(startTime, endTime, notes = '') {
        try {
            const userId = this.tg.initDataUnsafe.user?.id;
            const today = new Date().toISOString().split('T')[0];
            
            const response = await fetch(`${this.API_BASE}/hours/record`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    date: today,
                    startTime,
                    endTime,
                    notes
                })
            });
            
            if (response.ok) {
                this.tg.showPopup({
                    title: 'Успех',
                    message: 'Часы успешно записаны!',
                    buttons: [{ type: 'ok' }]
                });
                this.loadSchedule();
            }
        } catch (error) {
            console.error('Error saving work record:', error);
        }
    }
}
