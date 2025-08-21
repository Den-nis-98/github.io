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
const bot = new Telegraf(process.env.BOT_TOKEN);

// Хранилище данных
const monthlySchedules = new Map(); // График на месяц
const users = new Map();

// Генерация пустого графика на месяц
function generateEmptyMonthSchedule(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const schedule = {};
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        schedule[date] = {
            working: false,
            startTime: null,
            endTime: null,
            hours: 0,
            notes: ''
        };
    }
    
    return schedule;
}

// Расчет количества часов между двумя временами
function calculateHours(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    let startTotal = startHour * 60 + startMinute;
    let endTotal = endHour * 60 + endMinute;
    
    if (endTotal < startTotal) {
        endTotal += 24 * 60; // Если работа через полночь
    }
    
    const totalMinutes = endTotal - startTotal;
    return (totalMinutes / 60).toFixed(1);
}

// API Routes

// Получение графика на месяц
app.get('/api/schedule/:userId/:year/:month', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month) - 1; // JavaScript months are 0-based
        
        const userSchedules = monthlySchedules.get(userId) || {};
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        let schedule = userSchedules[monthKey];
        if (!schedule) {
            schedule = generateEmptyMonthSchedule(year, month);
            userSchedules[monthKey] = schedule;
            monthlySchedules.set(userId, userSchedules);
        }
        
        // Подсчет статистики
        const workingDays = Object.values(schedule).filter(day => day.working).length;
        const totalHours = Object.values(schedule).reduce((sum, day) => sum + day.hours, 0);
        
        res.json({
            success: true,
            data: schedule,
            stats: {
                workingDays,
                totalHours: totalHours.toFixed(1),
                averageHours: workingDays > 0 ? (totalHours / workingDays).toFixed(1) : 0
            }
        });
        
    } catch (error) {
        console.error('Error getting schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Сохранение дня в графике
app.post('/api/schedule/day', (req, res) => {
    try {
        const { userId, date, working, startTime, endTime, notes } = req.body;
        
        if (!userId || !date) {
            return res.status(400).json({
                success: false,
                error: 'User ID and date are required'
            });
        }
        
        const userSchedules = monthlySchedules.get(parseInt(userId)) || {};
        const [year, month] = date.split('-');
        const monthKey = `${year}-${month}`;
        
        if (!userSchedules[monthKey]) {
            userSchedules[monthKey] = generateEmptyMonthSchedule(parseInt(year), parseInt(month) - 1);
        }
        
        const hours = working ? calculateHours(startTime, endTime) : 0;
        
        userSchedules[monthKey][date] = {
            working,
            startTime: working ? startTime : null,
            endTime: working ? endTime : null,
            hours: parseFloat(hours),
            notes: notes || ''
        };
        
        monthlySchedules.set(parseInt(userId), userSchedules);
        
        res.json({
            success: true,
            data: userSchedules[monthKey][date],
            message: 'Day schedule saved successfully'
        });
        
    } catch (error) {
        console.error('Error saving day schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Массовое сохранение графика (например, шаблон на неделю)
app.post('/api/schedule/template', (req, res) => {
    try {
        const { userId, month, template } = req.body;
        
        if (!userId || !month || !template) {
            return res.status(400).json({
                success: false,
                error: 'User ID, month and template are required'
            });
        }
        
        const userSchedules = monthlySchedules.get(parseInt(userId)) || {};
        if (!userSchedules[month]) {
            res.status(404).json({
                success: false,
                error: 'Month schedule not found'
            });
            return;
        }
        
        // Применяем шаблон ко всем дням месяца
        Object.keys(userSchedules[month]).forEach(date => {
            const dayOfWeek = new Date(date).getDay(); // 0 - воскресенье, 1 - понедельник, etc.
            const dayTemplate = template[dayOfWeek];
            
            if (dayTemplate) {
                userSchedules[month][date] = {
                    working: dayTemplate.working,
                    startTime: dayTemplate.startTime,
                    endTime: dayTemplate.endTime,
                    hours: dayTemplate.working ? calculateHours(dayTemplate.startTime, dayTemplate.endTime) : 0,
                    notes: dayTemplate.notes || ''
                };
            }
        });
        
        monthlySchedules.set(parseInt(userId), userSchedules);
        
        res.json({
            success: true,
            message: 'Template applied successfully'
        });
        
    } catch (error) {
        console.error('Error applying template:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Telegram Bot Handlers

// Команда /plan - планирование графика
bot.command('plan', (ctx) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    ctx.reply(
        '📅 Планирование графика работы\n\n' +
        'Выберите действие:',
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '📝 Запланировать день',
                            callback_data: `plan_day`
                        }
                    ],
                    [
                        {
                            text: '📋 Шаблон на неделю',
                            callback_data: `plan_template`
                        }
                    ],
                    [
                        {
                            text: '👀 Посмотреть график',
                            web_app: { url: `${process.env.FRONTEND_URL}?month=${currentYear}-${currentMonth}` }
                        }
                    ]
                ]
            }
        }
    );
});

// Планирование конкретного дня
bot.action('plan_day', (ctx) => {
    ctx.deleteMessage();
    
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    ctx.reply(
        '📝 Запланировать рабочий день\n\n' +
        'Введите дату и время в формате:\n' +
        '<code>ГГГГ-ММ-ДД ЧЧ:ММ ЧЧ:ММ Заметка</code>\n\n' +
        'Примеры:\n' +
        '<code>2024-05-20 09:00 18:00 Работа в офисе</code>\n' +
        '<code>2024-05-21 10:00 19:00 Удалённая работа</code>\n' +
        '<code>2024-05-22 выходной</code>',
        { parse_mode: 'HTML' }
    );
});

// Шаблон на неделю
bot.action('plan_template', (ctx) => {
    ctx.deleteMessage();
    
    ctx.reply(
        '📋 Создание шаблона на неделю\n\n' +
        'Введите шаблон в формате:\n' +
        '<code>ПН 09:00 18:00\nВТ 10:00 19:00\nСР выходной\n...</code>\n\n' +
        'Дни недели: ПН, ВТ, СР, ЧТ, ПТ, СБ, ВС',
        { parse_mode: 'HTML' }
    );
});

// Обработчик текстовых сообщений для планирования
bot.on('text', (ctx) => {
    const text = ctx.message.text.trim();
    const userId = ctx.from.id;
    
    // Обработка планирования дня
    const dayRegex = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})(?:\s+(.+))?$/;
    const dayMatch = text.match(dayRegex);
    
    // Обработка выходного дня
    const dayOffRegex = /^(\d{4}-\d{2}-\d{2})\s+выходной(?:\s+(.+))?$/i;
    const dayOffMatch = text.match(dayOffRegex);
    
    if (dayMatch) {
        const date = dayMatch[1];
        const startTime = dayMatch[2];
        const endTime = dayMatch[3];
        const notes = dayMatch[4] || '';
        
        // Сохраняем в базу
        const userSchedules = monthlySchedules.get(userId) || {};
        const [year, month] = date.split('-');
        const monthKey = `${year}-${month}`;
        
        if (!userSchedules[monthKey]) {
            userSchedules[monthKey] = generateEmptyMonthSchedule(parseInt(year), parseInt(month) - 1);
        }
        
        const hours = calculateHours(startTime, endTime);
        
        userSchedules[monthKey][date] = {
            working: true,
            startTime,
            endTime,
            hours: parseFloat(hours),
            notes
        };
        
        monthlySchedules.set(userId, userSchedules);
        
        ctx.reply(
            `✅ День запланирован!\n\n` +
            `📅 Дата: ${date}\n` +
            `🕐 Время: ${startTime} - ${endTime}\n` +
            `⏱ Часов: ${hours}\n` +
            `📝 Заметка: ${notes || 'нет'}`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '📅 Посмотреть весь график',
                            web_app: { url: `${process.env.FRONTEND_URL}?month=${monthKey}` }
                        }
                    ]]
                }
            }
        );
        
    } else if (dayOffMatch) {
        const date = dayOffMatch[1];
        const notes = dayOffMatch[2] || 'Выходной';
        
        const userSchedules = monthlySchedules.get(userId) || {};
        const [year, month] = date.split('-');
        const monthKey = `${year}-${month}`;
        
        if (!userSchedules[monthKey]) {
            userSchedules[monthKey] = generateEmptyMonthSchedule(parseInt(year), parseInt(month) - 1);
        }
        
        userSchedules[monthKey][date] = {
            working: false,
            startTime: null,
            endTime: null,
            hours: 0,
            notes
        };
        
        monthlySchedules.set(userId, userSchedules);
        
        ctx.reply(
            `✅ Выходной запланирован!\n\n` +
            `📅 Дата: ${date}\n` +
            `📝 Заметка: ${notes}`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '📅 Посмотреть весь график',
                            web_app: { url: `${process.env.FRONTEND_URL}?month=${monthKey}` }
                        }
                    ]]
                }
            }
        );
    }
});

// Запуск сервера
async function startServer() {
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
