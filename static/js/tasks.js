let taskData = null;
let replacements = {}; 
let isNormalFreq = false; 
let timeRemainingSeconds = 0;
let timerInterval = null;

async function startTask() {
    const response = await fetch('/api/tasks/1');
    taskData = await response.json();
    replacements = taskData.current_replacements || {};

    // ЛОГИКА ПРИЕМКИ ВРЕМЕНИ ИЗ ПРЕДЫДУЩЕГО ОКНА
    const urlParams = new URLSearchParams(window.location.search);
    let secondsFromUrl = urlParams.get('seconds');

    if (secondsFromUrl) {
        timeRemainingSeconds = parseInt(secondsFromUrl);
    } else {
        timeRemainingSeconds = (taskData.current_time_left || 40) * 60;
    }

    startTimer();
    renderInputs();
    renderDecodedText();
    updateChart();
    document.getElementById('lestrade-text').innerText = taskData.intro_slides[0] || "Изучаю шифр...";
}

function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        if (timeRemainingSeconds > 0) {
            timeRemainingSeconds--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            alert("Время вышло!");
            window.location.href = '/game'; 
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

function renderInputs() {
    const grid = document.getElementById('inputs-grid');
    const uniqueLetters = [...new Set(taskData.ciphertext.toLowerCase().replace(/[^а-яё]/g, ''))].sort();
    grid.innerHTML = "";
    uniqueLetters.forEach(letter => {
        const div = document.createElement('div');
        div.className = 'input-pair';
        div.innerHTML = `<span>${letter.toUpperCase()} &rarr;</span><input type="text" maxlength="1" class="y-input" value="${replacements[letter] || ''}" data-char="${letter}">`;
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

function renderDecodedText() {
    const display = document.getElementById('decoded-display');
    let newText = "";
    for (let char of taskData.ciphertext) {
        const lowerChar = char.toLowerCase();
        if (replacements[lowerChar]) {
            newText += `<span class="highlight-replace">${replacements[lowerChar].toUpperCase()}</span>`;
        } else {
            newText += char;
        }
    }
    display.innerHTML = newText;
}

// График
let chartInstance = null;
const russianFreq = { 'о': 10.9, 'е': 8.4, 'а': 8.0, 'и': 7.3, 'н': 6.7, 'т': 6.2, 'с': 5.4, 'р': 4.7 }; 
function updateChart() {
    const ctx = document.getElementById('freq-chart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const data = isNormalFreq ? russianFreq : taskData.frequencies;
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{ label: isNormalFreq ? "Язык" : "Шифр", data: Object.values(data), backgroundColor: '#4a3621' }]
        }
    });
}
document.getElementById('switch-chart-btn').onclick = () => { isNormalFreq = !isNormalFreq; updateChart(); };

// ОТПРАВКА
document.getElementById('submit-btn').onclick = async () => {
    const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ task_id: 1, replacements: replacements })
    });
    const result = await res.json();
    
    if (result.status === 'success') {
        clearInterval(timerInterval);
        // После успеха переходим к следующей сцене, передав время дальше
        window.location.href = `/game?scene_id=3&seconds=${timeRemainingSeconds}`; 
    } else {
        const penaltyPopup = document.getElementById('penalty-popup');
        penaltyPopup.innerText = "-10:00 MIN";
        penaltyPopup.style.display = 'inline';
        // ШТРАФ 10 МИНУТ
        timeRemainingSeconds = Math.max(0, timeRemainingSeconds - 600);
        updateTimerDisplay();
        document.getElementById('lestrade-text').innerText = "Лестрейд: " + result.message;
        setTimeout(() => { penaltyPopup.style.display = 'none'; }, 2000);
    }
};

startTask();