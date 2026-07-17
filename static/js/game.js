let sceneData = null;
let currentStep = 0;
let currentState = 'intro_steps';
let isTyping = false;
let typingTimeout = null;
let searchTimerInterval = null;
let searchTimeSeconds = 0;

async function loadScene() {
    const timerBlock = document.getElementById('search-timer-block');
    if (timerBlock) timerBlock.style.display = 'none';

    const urlParams = new URLSearchParams(window.location.search);
    let sceneId = parseInt(urlParams.get('scene_id')) || 1; 
    let secondsFromUrl = urlParams.get('seconds');

    if (secondsFromUrl) searchTimeSeconds = parseInt(secondsFromUrl);

    const response = await fetch(`/api/scene?scene_id=${sceneId}`);
    sceneData = await response.json();
    
    currentStep = 0; 
    currentState = (sceneData.intro_steps && sceneData.intro_steps.length > 0) ? 'intro_steps' : 'dialogue_steps';

    render();

    if (sceneId % 2 === 0 && searchTimeSeconds > 0) {
        startSearchTimer(false); 
    }
}

function render() {
    const step = sceneData[currentState][currentStep];
    const gameScreen = document.getElementById('game-screen');

    if (step.is_title_screen) gameScreen.classList.add('title-mode');
    else gameScreen.classList.remove('title-mode');

    if (!step.is_title_screen) {
        const bgFile = step.background || sceneData.background;
        document.getElementById('bg-layer').style.backgroundImage = `url('/static/images/backgrounds/${bgFile}')`;
    }

    const charImg = document.getElementById('char-img');
    if (step.character && !step.is_title_screen) {
        charImg.src = `/static/images/characters/${step.character}.png`;
        charImg.style.display = 'block';
    } else {
        charImg.style.display = 'none';
    }

    typeWriter(step.text);

    if (step.text.includes("Время пошло") || step.text.includes("Отсчет пошел")) {
        startSearchTimer(true);
    }

    if (step.system_notification || sceneData.system_notification) {
        let msg = step.system_notification || sceneData.system_notification;
        setTimeout(() => {
            showSystemMessage(msg);
            sceneData.system_notification = null;
        }, 1000);
    }
}

function typeWriter(text) {
    const textElement = document.getElementById('main-dialogue');
    clearTimeout(typingTimeout);
    textElement.innerText = ""; 
    isTyping = true;
    let i = 0;
    function type() {
        if (i < text.length) {
            textElement.innerText += text.charAt(i);
            i++;
            typingTimeout = setTimeout(type, 20);
        } else isTyping = false;
    }
    type();
}

function showSystemMessage(text, callback) {
    const overlay = document.getElementById('system-notification');
    document.getElementById('notification-text').innerText = text.toUpperCase();
    overlay.style.display = 'flex';

    if (text.includes("БАЗОЙ ДАННЫХ")) {
        searchTimeSeconds = Math.max(0, searchTimeSeconds - 600);
        updateSearchTimerDisplay();
        const penalty = document.getElementById('game-penalty-popup');
        if (penalty) {
            penalty.innerText = "-10:00 MIN";
            penalty.classList.add('penalty-animation');
            setTimeout(() => penalty.classList.remove('penalty-animation'), 2000);
        }
    }

    document.getElementById('close-notification').onclick = () => {
        overlay.style.display = 'none';
        if (callback) callback();
    };
}

document.getElementById('click-overlay').addEventListener('click', () => {
    // 1. Ускорение текста
    if (isTyping) {
        clearTimeout(typingTimeout);
        document.getElementById('main-dialogue').innerText = sceneData[currentState][currentStep].text;
        isTyping = false;
        return; 
    }

    // 2. Логика Титров (Сцена 7)
    // Если мы в 7 сцене и интерактив был удален (значит, мы сделали выбор)
    if (sceneData.scene_id == 7 && sceneData.final_choice_interact === null) {
        showCredits();
        return;
    }

    // 3. Телефон
    if (currentState === 'intro_steps' && currentStep === sceneData.intro_steps.length - 1 && sceneData.phone_trigger) {
        showPhoneUI();
        return;
    }

    // 4. Обычное листание
    if (currentStep < sceneData[currentState].length - 1) {
        currentStep++;
        render();
    } else {
        if (currentState === 'intro_steps' && sceneData.dialogue_steps) {
            currentState = 'dialogue_steps';
            currentStep = 0;
            render();
        } else if (sceneData.search_interact || sceneData.final_choice_interact) {
            showSearchUI();
        } else {
            handleEndOfScene();
        }
    }
});

function handleEndOfScene() {
    const sceneId = parseInt(sceneData.scene_id);
    if (sceneId === 1) window.location.href = `/tasks?task_id=1&seconds=${searchTimeSeconds}`;
    else if (sceneId === 3) window.location.href = `/tasks?task_id=2&seconds=${searchTimeSeconds}`;
    else if (sceneId === 5) window.location.href = `/tasks?task_id=3&seconds=${searchTimeSeconds}`;
    else if (sceneId === 7) { /* Ничего не делаем, ждем клика для титров */ } 
    else window.location.href = `/game?scene_id=${sceneId + 1}&seconds=${searchTimeSeconds}`;
}

function startSearchTimer(reset = true) {
    const timerBlock = document.getElementById('search-timer-block');
    if (timerBlock) timerBlock.style.display = 'flex';
    if (reset) searchTimeSeconds = (sceneData.current_time_left || 40) * 60;
    if (searchTimerInterval) clearInterval(searchTimerInterval);
    searchTimerInterval = setInterval(() => {
        if (searchTimeSeconds > 0) { searchTimeSeconds--; updateSearchTimerDisplay(); }
        else { clearInterval(searchTimerInterval); window.location.href = `/game?scene_id=${sceneData.scene_id}&seconds=0`; }
    }, 1000);
}

function updateSearchTimerDisplay() {
    const timerDisplay = document.getElementById('game-timer-display');
    if (!timerDisplay) return;
    const minutes = Math.floor(searchTimeSeconds / 60);
    let seconds = searchTimeSeconds % 60;
    if (seconds < 10) seconds = '0' + seconds;
    timerDisplay.innerText = `${minutes}:${seconds}`;
}

function showPhoneUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = `<div class="phone-trigger-wrapper pos-phone"><div class="phone-arrow"></div><button class="phone-custom-btn">${sceneData.phone_trigger.prompt}</button></div>`;
    overlay.querySelector('.phone-custom-btn').onclick = () => { overlay.innerHTML = ""; currentState = 'dialogue_steps'; currentStep = 0; render(); };
}

function showSearchUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = "";
    
    let choices = sceneData.search_interact ? sceneData.search_interact.choices : sceneData.final_choice_interact.choices;

    choices.forEach(choice => {
        const wrapper = document.createElement('div');
        wrapper.className = `phone-trigger-wrapper pos-${choice.id}`;
        const arrowClass = (choice.id === 'door' || choice.id === 'pick_card') ? 'phone-arrow arrow-right' : 'phone-arrow';
        wrapper.innerHTML = `<div class="${arrowClass}"></div><button class="phone-custom-btn">${choice.text}</button>`;
        wrapper.querySelector('.phone-custom-btn').onclick = () => handleSearchAction(choice.id);
        overlay.appendChild(wrapper);
    });
}

async function handleSearchAction(actionId) {
    const response = await fetch('/api/game/action', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ action_id: actionId }) 
    });
    const result = await response.json();
    
    // Очищаем экран от стрелок
    document.getElementById('choices-overlay').innerHTML = "";

    // --- 1. ЛОГИКА ФИНАЛА (СЦЕНА 7) ---
    if (result.status === 'start_final_puzzle') {
        sceneData.final_choice_interact = null; // Отключаем стрелки навсегда
        
        if (result.dialogue_step) {
            // Подменяем текст текущего кадра на финальный
            sceneData[currentState][currentStep] = { text: result.dialogue_step.text };
            
            // ВАЖНО: мы запускаем печатную машинку и ждем, пока она не закончит, 
            // прежде чем показать пазл.
            typeWriter(result.dialogue_step.text);
            
            // Как узнать, что текст допечатался? Запускаем цикл проверки
            let checkTyping = setInterval(() => {
                if (!isTyping) { // Как только машинка остановилась (сама или по клику)
                    clearInterval(checkTyping);
                    startFinalPuzzle(result.puzzle_config); // Вызываем окно ввода!
                }
            }, 500);
        } else {
            // Если пред-текста нет, запускаем пазл сразу
            startFinalPuzzle(result.puzzle_config);
        }
        return;
    } 
    else if (result.status === 'game_over_credits') {
        sceneData.final_choice_interact = null; 
        if (result.dialogue_step) {
            sceneData[currentState][currentStep] = { text: result.dialogue_step.text };
            typeWriter(result.dialogue_step.text);
        }
        return; // Ждем клика игрока по экрану для показа титров
    }
    
    // ... остальной код функции (штрафы времени, победа, диалог допроса и т.д.) ...

    // 2. ОБНОВЛЕНИЕ ВРЕМЕНИ ДЛЯ ПОИСКА (штрафы)
    if (result.time_left !== undefined && result.time_left !== null) {
        let newTimeMinutes = Array.isArray(result.time_left) ? result.time_left[0] : result.time_left;
        let newTimeSeconds = newTimeMinutes * 60;

        if (newTimeSeconds < searchTimeSeconds) {
            let diff = Math.floor((searchTimeSeconds - newTimeSeconds) / 60);
            searchTimeSeconds = newTimeSeconds;
            updateSearchTimerDisplay();
            
            const penalty = document.getElementById('game-penalty-popup');
            if (penalty) {
                penalty.innerText = `-${diff}:00 MIN`; 
                penalty.style.display = 'inline';
                penalty.classList.add('penalty-animation');
                setTimeout(() => { 
                    penalty.classList.remove('penalty-animation');
                    penalty.style.display = 'none';
                }, 2000);
            }
        }
    }

    // 3. ПОБЕДА И ПЕРЕХОД К ЗАДАНИЮ
    if (result.status === 'win') { 
        clearInterval(searchTimerInterval);
        handleEndOfScene(); 
    } 
    // 4. ДИАЛОГ (Например, допрос курьера в 5 сцене)
    else if (result.dialogue_steps && result.dialogue_steps.length > 0) {
        // !!! ВОТ ИСПРАВЛЕНИЕ !!!
        sceneData.search_interact = null; // ЗАСТАВЛЯЕМ ИГРУ ЗАБЫТЬ ПРО СТРЕЛКИ
        // -------------------------

        currentState = 'dialogue_steps';
        currentStep = 0;
        sceneData.dialogue_steps = result.dialogue_steps; 
        render(); // Рисуем новый текст
    } 
    // 5. ОШИБКА ПОИСКА (Неправильный шкаф в 1 сцене)
    else {
        document.getElementById('main-dialogue').innerText = result.text || "Ничего не произошло.";
    }
}

// --- ФИНАЛЬНЫЙ ПАЗЛ (СЦЕНА 7) ---
function startFinalPuzzle(config) {
    let timeLeft = config.timer_limit_seconds || 35;
    const overlay = document.getElementById('choices-overlay');
    const mainClickLayer = document.getElementById('click-overlay');

    mainClickLayer.style.pointerEvents = 'none';

    overlay.innerHTML = `
        <div id="final-puzzle-box">
            <div id="final-timer">${timeLeft}</div>
            <p class="final-puzzle-title">КТО ОСТАВИЛ ЭТОТ ЛИСТОК?</p>
            <input type="text" id="final-input" placeholder="..." autocomplete="off">
            <br>
            <button id="final-submit" class="btn-task">СДАТЬ ОТВЕТ</button>
        </div>
    `;

    setTimeout(() => {
        const input = document.getElementById('final-input');
        if (input) input.focus();
    }, 200);

    const timer = setInterval(() => {
        timeLeft--;
        const timerElem = document.getElementById('final-timer');
        if (timerElem) timerElem.innerText = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            mainClickLayer.style.pointerEvents = 'auto'; 
            renderFinalBranch(config.lose_branch);
        }
    }, 1000);

    document.getElementById('final-submit').onclick = (e) => {
        e.stopPropagation(); 
        const input = document.getElementById('final-input');
        const val = input.value.toUpperCase().trim();
        
        clearInterval(timer);
        mainClickLayer.style.pointerEvents = 'auto'; 

        if (val === config.correct_word.toUpperCase()) {
            renderFinalBranch(config.win_branch);
        } else {
            renderFinalBranch(config.lose_branch);
        }
    };
}

function renderFinalBranch(branch) {
    document.getElementById('choices-overlay').innerHTML = "";
    sceneData.final_choice_interact = null; 
    
    // Создаем временный шаг, чтобы по клику можно было ускорить
    sceneData[currentState][currentStep] = { text: branch.text };
    typeWriter(branch.text);
    // Ждем клика игрока для показа титров
}

function showCredits() {
    const gameScreen = document.getElementById('game-screen');
    gameScreen.innerHTML = `
        <div style="width:100%; height:100%; background:black; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:'Arcade', sans-serif; text-align:center; animation: fadeIn 3s;">
            <h1 style="font-size:60px; color:#FFB84C; margin-bottom: 20px;">КОНЕЦ ДЕЛА</h1>
            <p style="font-size:28px;">Спасибо за прохождение нашего детективчика!</p>
            <button onclick="window.location.href='/'" class="btn-task" style="margin-top:60px; color:#FFB84C; text-decoration:underline; background:none; border:none; cursor:pointer; font-size:28px;">В ГЛАВНОЕ МЕНЮ</button>
        </div>
    `;
}

loadScene();