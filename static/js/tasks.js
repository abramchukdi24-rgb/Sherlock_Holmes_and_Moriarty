let taskData = null;
let replacements = {}; 
let isNormalFreq = false; 
let timeRemainingSeconds = 0;
let timerInterval = null;
let scytaleApplied = false; // Переменная для режима Скиталы

// 1. ЗАГРУЗКА ЗАДАЧИ
async function startTask() {
    const urlParams = new URLSearchParams(window.location.search);
    let taskId = urlParams.get('task_id') || 1;
    let secondsFromUrl = urlParams.get('seconds');

    const response = await fetch(`/api/tasks/${taskId}`);
    taskData = await response.json();
    replacements = taskData.current_replacements || {};

    // ПРИНУДИТЕЛЬНОЕ ВРЕМЯ:
    // Если секунды есть в URL - берем их, если нет - берем 40 минут (2400 сек)
    if (secondsFromUrl !== null && secondsFromUrl !== undefined) {
        timeRemainingSeconds = parseInt(secondsFromUrl);
    } else {
        timeRemainingSeconds = (taskData.current_time_left || 40) * 60;
    }
    
    // Если время всё равно 0 - даем 40 минут, чтобы игра не умирала сразу
    if (timeRemainingSeconds <= 0) timeRemainingSeconds = 2400;

    startTimer();
    renderInputs();
    renderDecodedText();
    updateChart();
    
    document.getElementById('lestrade-text').innerText = taskData.intro_slides[0] || "Изучаю шифр...";
    // Показываем кнопки только во втором задании
    if (taskData.task_id === 2) {
        document.getElementById("scytale-btn").style.display = "inline-block";
    }
}

// 2. ТАЙМЕР
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        if (timeRemainingSeconds > 0) {
            timeRemainingSeconds--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            showSystemMessage("ВРЕМЯ ВЫШЛО!", () => {
                let deathScene = taskData.task_id * 2;
                window.location.href = `/game?scene_id=${deathScene}&seconds=0`; 
            });
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElem = document.getElementById('timer-display');
    if (!timerElem) return;
    const minutes = Math.floor(timeRemainingSeconds / 60);
    let seconds = timeRemainingSeconds % 60;
    if (seconds < 10) seconds = '0' + seconds;
    timerElem.innerText = `${minutes}:${seconds}`;
}

// 3. ИНПУТЫ
function renderInputs() {
    const grid = document.getElementById('inputs-grid');
    if (!grid) return;
    const uniqueLetters = [...new Set(taskData.ciphertext.toLowerCase().replace(/[^а-яё]/g, ''))].sort();
    
    grid.innerHTML = "";
    uniqueLetters.forEach(letter => {
        const div = document.createElement('div');
        div.className = 'input-pair';
        div.innerHTML = `<span>${letter.toUpperCase()} &rarr;</span><input type="text" maxlength="1" class="y-input" value="${replacements[letter] || ''}" data-char="${letter}" name="cipher_input">`;
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

// 4. Отрисовка текста (С ЗАМЕНОЙ И СКИТАЛОЙ)
function renderDecodedText() {
    const display = document.getElementById('decoded-display');
    if (!display) return;

    // Сначала делаем подстановку букв
    let baseText = "";
    for (let char of taskData.ciphertext) {
        const lowerChar = char.toLowerCase();
        if (replacements[lowerChar]) {
            baseText += replacements[lowerChar].toUpperCase();
        } else {
            baseText += char;
        }
    }

    // Если включен режим Скиталы - берем каждый 4-й символ
    if (scytaleApplied) {
        let filtered = "";
        // Убираем переносы строк для корректного счета скиталы
        let cleanText = baseText.replace(/\n/g, ''); 
        for (let i = 0; i < cleanText.length; i += 4) {
            filtered += cleanText[i];
        }
        display.innerHTML = `<span class="highlight-replace">${filtered}</span>`;
    } else {
        // Обычный режим - просто подсвечиваем замененные буквы
        let htmlResult = "";
        for (let char of taskData.ciphertext) {
            const lowerChar = char.toLowerCase();
            if (replacements[lowerChar]) {
                htmlResult += `<span class="highlight-replace">${replacements[lowerChar].toUpperCase()}</span>`;
            } else {
                htmlResult += char;
            }
        }
        display.innerHTML = htmlResult;
    }
}

// 5. ГРАФИК
let chartInstance = null;
const russianFreq = { 'о': 10.9, 'е': 8.4, 'а': 8.0, 'и': 7.3, 'н': 6.7, 'т': 6.2, 'с': 5.4, 'р': 4.7, 'в': 4.5, 'л': 4.4, 'к': 3.5, 'м': 3.2, 'д': 3.0, 'п': 2.8, 'у': 2.6, 'я': 2.0, 'ы': 1.9, 'ь': 1.7, 'г': 1.7, 'з': 1.6, 'б': 1.6, 'ч': 1.4, 'й': 1.2, 'х': 1.0, 'ж': 0.9, 'ш': 0.7, 'ю': 0.6, 'ц': 0.5, 'щ': 0.4, 'э': 0.3, 'ф': 0.2 }; 

function updateChart() {
    const ctx = document.getElementById('freq-chart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const data = isNormalFreq ? russianFreq : taskData.frequencies;
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{ label: isNormalFreq ? "Язык (%)" : "Шифр (%)", data: Object.values(data), backgroundColor: '#4a3621' }]
        },
        options: { scales: { y: { beginAtZero: true } } }
    });
}
document.getElementById('switch-chart-btn').onclick = () => { isNormalFreq = !isNormalFreq; updateChart(); };

// 6. СДАЧА ОТВЕТА
document.getElementById('submit-btn').onclick = async () => {
    const currentTaskId = taskData.task_id;
    const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            task_id: currentTaskId, 
            replacements: replacements,
            scytale_applied: scytaleApplied // Отправляем статус скиталы
        })
    });
    const result = await res.json();
    
    if (result.status === 'success') {
        clearInterval(timerInterval);
        let nextScene = currentTaskId * 2; 
        window.location.href = `/game?scene_id=${nextScene}&seconds=${timeRemainingSeconds}`; 
    } 
    // Если буквы верны, но скитала не нажата
    else if (result.status === 'trigger_scytale_hint') {
        showSystemMessage(result.message);
    } else {
        const penaltyPopup = document.getElementById('penalty-popup');
        if (penaltyPopup) {
            penaltyPopup.innerText = "-10:00 MIN";
            penaltyPopup.classList.add('penalty-animation');
            setTimeout(() => penaltyPopup.classList.remove('penalty-animation'), 2000);
        }
        // Отнимаем 10 минут
        timeRemainingSeconds = Math.max(0, timeRemainingSeconds - 600);
        updateTimerDisplay();
        document.getElementById('lestrade-text').innerText = result.message;
    }
    
};

// 7. СИСТЕМНОЕ ОКНО
// Исправленная функция уведомлений в tasks.js
function showSystemMessage(text, callback) {
    const overlay = document.getElementById('system-notification');
    const textElem = document.getElementById('notification-text');
    const closeBtn = document.getElementById('close-notification');

    if (!overlay || !textElem) {
        console.error("Критическая ошибка: Элементы уведомления не найдены в HTML!");
        alert(text); // Резервный вариант, если HTML не прогрузился
        if (callback) callback();
        return;
    }

    textElem.innerText = text.toUpperCase();
    overlay.style.display = 'flex';

    closeBtn.onclick = () => {
        overlay.style.display = 'none';
        if (callback) callback();
    };
}

startTask();

// ======================
// Работа кнопок Скиталы
// ======================

const applyBtn = document.getElementById("scytale-btn");
const cancelBtn = document.getElementById("cancel-scytala-btn");

applyBtn.onclick = () => {
    scytaleApplied = true;

    renderDecodedText();

    applyBtn.style.display = "none";
    cancelBtn.style.display = "inline-block";
};

cancelBtn.onclick = () => {
    scytaleApplied = false;

    renderDecodedText();

    cancelBtn.style.display = "none";
    applyBtn.style.display = "inline-block";
};