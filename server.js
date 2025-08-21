require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация бота
const bot = new Telegraf(process.env.AAGL1KF81EWrsuZNHGDF5csjvLXCgCZzico);

// Хранилище данных
const schedules = new Map();
const workRecords = new Map();
const users = new Map();

// Генерация тестовых данных
function generateSampleData() {
    const sampleSchedule = [
        {
            id: 1,
            date: new Date().toISOString().split('T')[0],
            start: '09:00',
            end: '18:00',
            place: 'Главный офис',
            confirmed: true,
            type: 'work'
        }
    ];

    schedules.set(123456789, sampleSchedule);
}

// Функция для расчета отработанных часов
function calculateWorkHours(startTime, endTime) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    
    let diff = endTotal - startTotal;
    if (diff < 0) diff += 24 * 60; // Если работали через полночь
    
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    
    return { hours, minutes, total: diff };
}

// API Routes

// Получение графика и записей о работе
app.get('/api/schedule/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const period = req.query.period || 'week';
        
        const userSchedule = schedules.get(userId) || [];
        const userWorkRecords = workRecords.get(userId) || [];
        
        // Объединяем график и фактические записи
        const combinedData = userSchedule.map(shift => {
            const actualRecord = userWorkRecords.find(record => 
                record.date === shift.date && record.type === 'work'
            );
            
            return {
                ...shift,
                actualStart: actualRecord?.startTime,
                actualEnd: actualRecord?.endTime,
                actualHours: actualRecord?.hours,
                recorded: !!actualRecord
            };
        });
        
        res.json({
            success: true,
            data: combinedData,
            workRecords: userWorkRecords,
            total: combinedData.length
        });
        
    } catch (error) {
        console.error('Error getting schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Запись отработанных часов
app.post('/api/hours/record', (req, res) => {
    try {
        const { userId, date, startTime, endTime, notes } = req.body;
        
        if (!userId || !date || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        const userRecords = workRecords.get(parseInt(userId)) || [];
        const { hours, minutes, total } = calculateWorkHours(startTime, endTime);
        
        const newRecord = {
            id: Date.now(),
            date,
            startTime,
            endTime,
            hours,
            minutes,
            totalMinutes: total,
            notes: notes || '',
            recordedAt: new Date().toISOString(),
            type: 'work'
        };
        
        // Удаляем старую запись на эту дату, если есть
        const filteredRecords = userRecords.filter(record => record.date !== date);
        filteredRecords.push(newRecord);
        
        workRecords.set(parseInt(userId), filteredRecords);
        
        res.json({
            success: true,
            data: newRecord,
            message: 'Hours recorded successfully'
        });
        
    } catch (error) {
        console.error('Error recording hours:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Получение статистики по часам
app.get('/api/hours/stats/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const period = req.query.period || 'month';
        const userRecords = workRecords.get(userId) || [];
        
        const now = new Date();
        let filteredRecords = userRecords;
        
        if (period !== 'all') {
            const filterDate = new Date();
            if (period === 'week') filterDate.setDate(now.getDate() - 7);
            if (period === 'month') filterDate.setMonth(now.getMonth() - 1);
            if (period === 'year') filterDate.setFullYear(now.getFullYear() - 1);
            
            filteredRecords = userRecords.filter(record => 
                new Date(record.date) >= filterDate
            );
        }
        
        const totalHours = filteredRecords.reduce((sum, record) => sum + record.hours, 0);
        const totalMinutes = filteredRecords.reduce((sum, record) => sum + record.minutes, 0);
        const totalRecords = filteredRecords.length;
        
        const dailyAverage = totalRecords > 0 ? (totalHours + totalMinutes / 60) / totalRecords : 0;
        
        res.json({
            success: true,
            data: {
                totalHours: Math.floor(totalHours + totalMinutes / 60),
                totalRecords,
                dailyAverage: dailyAverage.toFixed(1),
                records: filteredRecords
            }
        });
        
    } catch (error) {
        console.error('Error getting hours stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Telegram Bot Handlers

// Команда /start
bot.start((ctx) => {
    const userId = ctx.from.id;
    users.set(userId, ctx.from);
    
    ctx.reply(
        `👋 Привет, ${ctx.from.first_name}!\n\n` +
        `Я бот для учета рабочего времени. Я помогу тебе:\n` +
        `• 📝 Записывать отработанные часы\n` +
        `• 📊 Смотреть статистику\n` +
        `• 📅 Управлять графиком смен\n\n` +
        `Используй кнопки ниже для быстрого доступа!`,
        {
            reply_markup: {
                keyboard: [
                    [{ text: "📝 Записать часы", web_app: { url: process.env.FRONTEND_URL } }],
                    [{ text: "📊 Статистика", web_app: { url: process.env.FRONTEND_URL + "#stats" } }],
                    [{ text: "📅 Мой график", web_app: { url: process.env.FRONTEND_URL } }]
                ],
                resize_keyboard: true
            }
        }
    );
});

// Команда записи часов
bot.command('hours', (ctx) => {
    ctx.reply(
        '🕐 Запись отработанных часов\n\nВведи время в формате:\n' +
        '<code>09:00 18:30 Заметка</code>\n\n' +
        'Пример: <code>09:00 18:30 Работа над проектом</code>',
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '📅 Записать на сегодня',
                        callback_data: 'record_today'
                    }
                ]]
            }
        }
    );
});

// Обработчик текстовых сообщений с временем
bot.on('text', (ctx) => {
    const text = ctx.message.text.trim();
    
    // Проверяем формат времени: "09:00 18:30 Заметка"
    const timeRegex = /^(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})(?:\s+(.+))?$/;
    const match = text.match(timeRegex);
    
    if (match) {
        const startTime = match[1];
        const endTime = match[2];
        const notes = match[3] || '';
        
        const userId = ctx.from.id;
        const today = new Date().toISOString().split('T')[0];
        
        const { hours, minutes } = calculateWorkHours(startTime, endTime);
        
        // Сохраняем запись
        const userRecords = workRecords.get(userId) || [];
        const newRecord = {
            id: Date.now(),
            date: today,
            startTime,
            endTime,
            hours,
            minutes,
            notes,
            recordedAt: new Date().toISOString()
        };
        
        userRecords.push(newRecord);
        workRecords.set(userId, userRecords);
        
        ctx.reply(
            `✅ Часы записаны!\n\n` +
            `📅 Дата: ${today}\n` +
            `🕐 Время: ${startTime} - ${endTime}\n` +
            `⏱ Отработано: ${hours}ч ${minutes}м\n` +
            `📝 Заметка: ${notes || 'нет'}`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '📊 Посмотреть статистику',
                            web_app: { url: process.env.FRONTEND_URL + "#stats" }
                        }
                    ]]
                }
            }
        );
    }
});

// Обработчик inline кнопок
bot.action('record_today', (ctx) => {
    ctx.deleteMessage();
    ctx.reply(
        'Введи время работы за сегодня в формате:\n' +
        '<code>09:00 18:30</code>',
        { parse_mode: 'HTML' }
    );
});

// Команда статистики
bot.command('stats', (ctx) => {
    const userId = ctx.from.id;
    const userRecords = workRecords.get(userId) || [];
    
    if (userRecords.length === 0) {
        ctx.reply('📊 У тебя пока нет записей о отработанном времени.');
        return;
    }
    
    const totalHours = userRecords.reduce((sum, record) => sum + record.hours, 0);
    const totalMinutes = userRecords.reduce((sum, record) => sum + record.minutes, 0);
    const totalHoursFormatted = (totalHours + totalMinutes / 60).toFixed(1);
    
    ctx.reply(
        `📊 Твоя статистика:\n\n` +
        `✅ Всего записей: ${userRecords.length}\n` +
        `⏱ Всего часов: ${totalHoursFormatted}\n` +
        `📅 Последняя запись: ${userRecords[userRecords.length - 1].date}`,
        {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '📈 Подробная статистика',
                        web_app: { url: process.env.FRONTEND_URL + "#stats" }
                    }
                ]]
            }
        }
    );
});

// Запуск сервера
async function startServer() {
    generateSampleData();
    
    await bot.launch();
    console.log('🤖 Telegram bot started');
    
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 API available at http://localhost:${PORT}/api`);
    });
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

startServer().catch(console.error);
