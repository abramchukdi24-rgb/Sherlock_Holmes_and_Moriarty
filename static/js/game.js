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
    let sceneId = urlParams.get('scene_id') || 1; 
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

    // --- ЛОГИКА ШТРАФА ВНУТРИ УВЕДОМЛЕНИЯ ---
    if (text.includes("БАЗОЙ ДАННЫХ")) {
        // Отнимаем 10 минут
        searchTimeSeconds = Math.max(0, searchTimeSeconds - 600);
        updateSearchTimerDisplay();
        
        // Показываем анимацию штрафа рядом с таймером
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
    if (isTyping) {
        clearTimeout(typingTimeout);
        document.getElementById('main-dialogue').innerText = sceneData[currentState][currentStep].text;
        isTyping = false;
        return; 
    }
    if (currentState === 'intro_steps' && currentStep === sceneData.intro_steps.length - 1 && sceneData.phone_trigger) {
        showPhoneUI();
        return;
    }
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
    console.log("Конец сцены, переходим:", sceneId);

    if (sceneId === 1) {
        window.location.href = `/tasks?task_id=1&seconds=${searchTimeSeconds}`;
    } else if (sceneId === 3) {
        window.location.href = `/tasks?task_id=2&seconds=${searchTimeSeconds}`;
    } else if (sceneId === 5) {
        window.location.href = `/tasks?task_id=3&seconds=${searchTimeSeconds}`;
    } else if (sceneId === 7) {
        window.location.href = '/'; 
    } else {
        window.location.href = `/game?scene_id=${sceneId + 1}&seconds=${searchTimeSeconds}`;
    }
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
    
    // 1. Убираем стрелки СРАЗУ, чтобы они не висели в допросной
    document.getElementById('choices-overlay').innerHTML = "";

    // 2. Обновляем время (чтобы штраф 10 минут за курьера отобразился)
    if (result.time_left !== undefined) {
        searchTimeSeconds = result.time_left * 60;
        updateSearchTimerDisplay();
    }

    // 3. Если выбрали "Вскрыть конверт" (win)
    if (result.status === 'win') { 
        clearInterval(searchTimerInterval);
        // Переходим к заданию (номер задания определится в handleEndOfScene)
        handleEndOfScene(); 
    } 
    // 4. Если выбрали "Допрос" (пришел новый текст)
    else if (result.dialogue_steps && result.dialogue_steps.length > 0) {
        // ВАЖНО: Удаляем поиск из данных, чтобы стрелки больше не появлялись!
        sceneData.search_interact = null; 

        currentState = 'dialogue_steps';
        currentStep = 0;
        sceneData.dialogue_steps = result.dialogue_steps; 

        render(); 
    }
    // 5. Обычная ошибка (как в 1 сцене)
    else {
        document.getElementById('main-dialogue').innerText = result.text;
    }
}

// --- ФИНАЛЬНЫЙ ПАЗЛ (СЦЕНА 7) ---
function startFinalPuzzle(config) {
    console.log("Запуск финального пазла с конфигом:", config); // Для отладки
    
    let timeLeft = config.timer_limit_seconds || 35;
    const overlay = document.getElementById('choices-overlay');
    const mainClickLayer = document.getElementById('click-overlay');

    // Блокируем клики по фону, чтобы не закрыть окно случайно
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

    // Автофокус на поле ввода
    setTimeout(() => {
        const input = document.getElementById('final-input');
        if (input) input.focus();
    }, 200);

    // Таймер
    const timer = setInterval(() => {
        timeLeft--;
        const timerElem = document.getElementById('final-timer');
        if (timerElem) {
            timerElem.innerText = timeLeft;
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            mainClickLayer.style.pointerEvents = 'auto'; 
            renderFinalBranch(config.lose_branch);
        }
    }, 1000);

    // Обработка клика по кнопке "Сдать"
    document.getElementById('final-submit').onclick = (e) => {
        e.stopPropagation(); // Защита от пролета клика сквозь кнопку
        
        const input = document.getElementById('final-input');
        const val = input.value.toUpperCase().trim();
        
        console.log("Введено слово:", val);
        clearInterval(timer); // Останавливаем таймер
        
        // Возвращаем возможность кликать по экрану
        mainClickLayer.style.pointerEvents = 'auto'; 

        // Проверяем ответ
        if (val === config.correct_word.toUpperCase()) {
            renderFinalBranch(config.win_branch);
        } else {
            renderFinalBranch(config.lose_branch);
        }
    };
}

// --- ОТРИСОВКА ИТОГА ФИНАЛА ---
function renderFinalBranch(branch) {
    console.log("Отрисовка финала:", branch);
    
    // 1. ВАЖНО: Удаляем данные об интерактиве, чтобы клики по экрану 
    // больше не вызывали появление стрелок/кнопок
    sceneData.search_interact = null;
    sceneData.final_choice_interact = null;
    currentState = 'dialogue_steps'; // Переключаем состояние в обычный текст

    // 2. Полностью очищаем слой с кнопками и окном ввода
    document.getElementById('choices-overlay').innerHTML = "";
    
    // 3. Выводим текст результата через нашу "печатную машинку"
    if (branch && branch.text) {
        typeWriter(branch.text);
    } else {
        document.getElementById('main-dialogue').innerText = "ИГРА ЗАВЕРШЕНА.";
    }

    // 4. Через 7 секунд показываем финальное системное уведомление
    setTimeout(() => {
        // Проверяем, не ушел ли пользователь уже со страницы
        if (window.location.pathname.includes('game')) {
            showSystemMessage("СПАСИБО ЗА ИГРУ! ВЫ ПРОШЛИ ДЕТЕКТИВЧИК ДО КОНЦА.", () => {
                window.location.href = '/'; // Возврат в меню
            });
        }
    }, 12000);
}

loadScene();