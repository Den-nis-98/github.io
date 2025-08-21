// app.js

// Инициализация Telegram Mini Apps
let tg = window.Telegram.WebApp;
tg.expand(); // Раскрываем приложение на весь экран
tg.enableClosingConfirmation(); // Включаем подтверждение закрытия

// Элементы DOM
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskDate = document.getElementById('task-date');
const chartContainer = document.getElementById('chart-container');

// Ключ для localStorage
const STORAGE_KEY = 'userChartData';

// Загружаем задачи при загрузке страницы
let tasks = loadTasks();
renderChart();

// Обработчик отправки формы
taskForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const taskText = taskInput.value.trim();
    const taskDateValue = taskDate.value;

    if (taskText && taskDateValue) {
        // Добавляем новую задачу
        tasks.push({
            id: Date.now(), // уникальный ID
            text: taskText,
            date: taskDateValue,
            completed: false
        });

        // Сохраняем, рисуем и очищаем форму
        saveTasks();
        renderChart();
        taskInput.value = '';
        taskDate.value = '';
    }
});

// Функция для загрузки задач из localStorage
function loadTasks() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Функция для сохранения задач в localStorage
function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Функция для отрисовки графика (простой пример)
function renderChart() {
    chartContainer.innerHTML = ''; // Очищаем контейнер

    if (tasks.length === 0) {
        chartContainer.innerHTML = '<p>Задач пока нет.</p>';
        return;
    }

    tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = `task ${task.completed ? 'completed' : ''}`;
        taskElement.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id})">
            <span>${task.text}</span> - <small>${task.date}</small>
            <button onclick="deleteTask(${task.id})">X</button>
        `;
        chartContainer.appendChild(taskElement);
    });
}

// Эти функции должны быть глобальными, чтобы работать из onclick
window.toggleTask = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderChart();
    }
};

window.deleteTask = function(taskId) {
    tasks = tasks.filter(t => t.id !== taskId);
    saveTasks();
    renderChart();
};
