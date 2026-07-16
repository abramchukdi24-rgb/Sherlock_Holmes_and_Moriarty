let taskData = null;
let replacements = {}; // Сохраняем замены тут
let isNormalFreq = false; // Какой график сейчас показываем

async function startTask() {
    // 1. Загружаем данные задачи №1
    const response = await fetch('/api/tasks/1');
    taskData = await response.json();
    
    // Подгружаем прошлые замены, если они были в сессии
    replacements = taskData.current_replacements || {};
    
    renderInputs();
    renderDecodedText();
    updateChart();
    
    // Подсказка Лестрейда (тоже печатной машинкой можно, но пока просто текст)
    document.getElementById('lestrade-text').innerText = taskData.intro_slides[0];
}

// Создаем инпуты для всех букв шифра
function renderInputs() {
    const grid = document.getElementById('inputs-grid');
    // Берем все уникальные буквы из шифра
    const uniqueLetters = [...new Set(taskData.ciphertext.toLowerCase().replace(/[^а-яё]/g, ''))].sort();
    
    grid.innerHTML = "";
    uniqueLetters.forEach(letter => {
        const div = document.createElement('div');
        div.className = 'input-pair';
        div.innerHTML = `
            <span>${letter.toUpperCase()} &rarr;</span>
            <input type="text" maxlength="1" class="y-input" value="${replacements[letter] || ''}" data-char="${letter}">
        `;
        
        // Когда пользователь вводит букву
        div.querySelector('input').addEventListener('input', (e) => {
            const cipherChar = e.target.dataset.char;
            const userChar = e.target.value.toLowerCase();
            
            if (userChar) replacements[cipherChar] = userChar;
            else delete replacements[cipherChar];
            
            renderDecodedText();
        });
        
        grid.appendChild(div);
    });
}

// Заменяем буквы в тексте
function renderDecodedText() {
    const display = document.getElementById('decoded-display');
    let newText = "";
    
    for (let char of taskData.ciphertext) {
        const lowerChar = char.toLowerCase();
        if (replacements[lowerChar]) {
            // Подсвечиваем замену
            newText += `<span class="highlight-replace">${replacements[lowerChar].toUpperCase()}</span>`;
        } else {
            newText += char;
        }
    }
    display.innerHTML = newText;
}

// График (Частотный анализ)
let chartInstance = null;
const russianFreq = { 'о': 10.9, 'е': 8.4, 'а': 8.0, 'и': 7.3, 'н': 6.7, 'т': 6.2, 'с': 5.4, 'р': 4.7 }; // Пример

function updateChart() {
    const ctx = document.getElementById('freq-chart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const data = isNormalFreq ? russianFreq : taskData.frequencies;
    const label = isNormalFreq ? "Частота в языке (%)" : "Частота в шифре (%)";

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: label,
                data: Object.values(data),
                backgroundColor: '#4a3621'
            }]
        }
    });
}

document.getElementById('switch-chart-btn').onclick = () => {
    isNormalFreq = !isNormalFreq;
    updateChart();
};

// При сдаче ответа в книге
document.getElementById('submit-btn').onclick = async () => {
    const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ task_id: 1, replacements: replacements })
    });
    const result = await res.json();
    
    if (result.status === 'success') {
        clearInterval(timerInterval);
        // Вместо алерта можно написать текст Лестрейду
        document.getElementById('lestrade-text').innerText = "Лестрейд: Отлично! Мы разгадали это. Едем дальше!";
        setTimeout(() => { window.location.href = '/game?scene_id=3'; }, 2000);
    } else {
        // ШТРАФ В КНИГЕ
        const penaltyPopup = document.getElementById('penalty-popup');
        penaltyPopup.innerText = "-10:00 MIN";
        penaltyPopup.style.display = 'inline';
        
        // Отнимаем время
        timeRemainingSeconds = Math.max(0, timeRemainingSeconds - 600);
        updateTimerDisplay();

        document.getElementById('lestrade-text').innerText = "Лестрейд: " + result.message;
        
        setTimeout(() => { penaltyPopup.style.display = 'none'; }, 2000);
    }
};
// --- ЛОГИКА ТИКАЮЩЕГО ТАЙМЕРА ---
function startTimer() {
    // ЖЕСТКАЯ ПРОВЕРКА: Если бэкэнд не прислал время, ставим 40 минут по умолчанию
    let minutesFromBackend = taskData.current_time_left;
    if (minutesFromBackend === undefined || minutesFromBackend === null) {
        minutesFromBackend = 40; 
        console.error("Бэкэнд не прислал время, поставили 40 минут!");
    }
    
    // Переводим минуты в секунды
    timeRemainingSeconds = minutesFromBackend * 60;
    
    // Показываем таймер на экране СРАЗУ
    updateTimerDisplay(); 
    
    // Запускаем бесконечный цикл, который срабатывает каждые 1000 миллисекунд (1 секунду)
    timerInterval = setInterval(() => {
        if (timeRemainingSeconds > 0) {
            // Отнимаем 1 секунду
            timeRemainingSeconds--;
            
            // Обновляем цифры на экране
            updateTimerDisplay();
        } else {
            // КОГДА ВРЕМЯ ВЫШЛО
            clearInterval(timerInterval); // Останавливаем тиканье
            alert("Время вышло! Скотленд-Ярд скорбит...");
            
            // Перекидываем на сцену смерти (у тебя это четные сцены, например scene_2_death.json)
            // Важно: в твоем app.py выдача сцен работает через /game, а не напрямую!
            window.location.href = '/game'; 
        }
    }, 1000); 
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemainingSeconds / 60);
    let seconds = timeRemainingSeconds % 60;
    if (seconds < 10) seconds = '0' + seconds;
    
    // Ищем элемент именно по этому ID
    const timerElem = document.getElementById('timer-display');
    if (timerElem) {
        timerElem.innerText = `${minutes}:${seconds}`;
    }
}

startTask();