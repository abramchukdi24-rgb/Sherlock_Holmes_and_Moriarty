let sceneData = null;
let currentStep = 0;
let currentState = 'intro_steps';

let isTyping = false;
let typingTimeout = null;

// 1. ЗАГРУЗКА ДАННЫХ
async function loadScene() {
    const response = await fetch('/api/scene?scene_id=1');
    sceneData = await response.json();
    render();
}

// 2. ГЛАВНЫЙ РЕНДЕР (Рисуем всё)
function render() {
    const step = sceneData[currentState][currentStep];
    const gameScreen = document.getElementById('game-screen');

    // --- ЛОГИКА ЗАСТАВКИ (TITLE SCREEN) ---
    if (step.is_title_screen) {
        gameScreen.classList.add('title-mode');
    } else {
        gameScreen.classList.remove('title-mode');
    }

    // --- ЛОГИКА ФОНА ---
    if (!step.is_title_screen) {
        const bgFile = step.background || sceneData.background;
        document.getElementById('bg-layer').style.backgroundImage = `url('/static/images/backgrounds/${bgFile}')`;
    }

    // --- ЛОГИКА ПЕРСОНАЖА ---
    const charImg = document.getElementById('char-img');
    if (step.character && !step.is_title_screen) {
        charImg.src = `/static/images/characters/${step.character}.png`;
        charImg.style.display = 'block';
    } else {
        charImg.style.display = 'none';
    }

    // --- ЗАПУСК ПЕЧАТНОЙ МАШИНКИ ---
    typeWriter(step.text);
}

// 3. ФУНКЦИЯ ПЕЧАТНОЙ МАШИНКИ
function typeWriter(text) {
    const textElement = document.getElementById('main-dialogue');
    clearTimeout(typingTimeout);
    textElement.innerText = ""; 
    isTyping = true;
    
    let i = 0;
    const speed = 25; // Скорость печати

    function type() {
        if (i < text.length) {
            textElement.innerText += text.charAt(i);
            i++;
            typingTimeout = setTimeout(type, speed);
        } else {
            isTyping = false;
        }
    }
    type();
}

// 4. ЛОГИКА КЛИКА ПО ЭКРАНУ
document.getElementById('click-overlay').addEventListener('click', () => {
    const step = sceneData[currentState][currentStep];

    // Если текст еще печатается — при клике показываем его СРАЗУ
    if (isTyping) {
        clearTimeout(typingTimeout);
        document.getElementById('main-dialogue').innerText = step.text;
        isTyping = false;
        return; 
    }

    // ТЕЛЕФОН: Если мы на последнем шаге Интро и есть триггер
    if (currentState === 'intro_steps' && currentStep === sceneData.intro_steps.length - 1 && sceneData.phone_trigger) {
        showPhoneUI();
        return;
    }

    // Листаем дальше
    if (currentStep < sceneData[currentState].length - 1) {
        currentStep++;
        render();
    } else {
        // Переход между блоками (Интро -> Диалоги)
        if (currentState === 'intro_steps') {
            currentState = 'dialogue_steps';
            currentStep = 0;
            render();
        } 
        // ВЫБОР (ПОИСК): Если кончились Диалоги и есть интерактив
        else if (currentState === 'dialogue_steps' && sceneData.search_interact) {
            showSearchUI();
        }
    }
});

// 5. ИНТЕРФЕЙС ТЕЛЕФОНА
function showPhoneUI() {
    const overlay = document.getElementById('choices-overlay');
    // Добавили класс pos-phone для позиционирования
    overlay.innerHTML = `
        <div class="phone-trigger-wrapper pos-phone">
            <div class="phone-arrow"></div>
            <button class="phone-custom-btn">
                ${sceneData.phone_trigger.prompt}
            </button>
        </div>
    `;
    
    overlay.querySelector('.phone-custom-btn').onclick = () => {
        overlay.innerHTML = "";
        currentState = 'dialogue_steps';
        currentStep = 0;
        render();
    };
}

// --- ДОБАВЛЯЕМ ПЕРЕМЕННЫЕ ДЛЯ ТАЙМЕРА ---
let searchTimerInterval = null;
let searchTimeSeconds = 0;

// 6. ИНТЕРФЕЙС ПОИСКА (Стол, Шкаф, Дверь)
function showSearchUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = "";
    
    // 1. ЗАПУСКАЕМ ТАЙМЕР!
    startSearchTimer();

    sceneData.search_interact.choices.forEach(choice => {
        const wrapper = document.createElement('div');
        wrapper.className = `phone-trigger-wrapper pos-${choice.id}`;
        
        const arrowClass = (choice.id === 'door') ? 'phone-arrow arrow-right' : 'phone-arrow';

        wrapper.innerHTML = `
            <div class="${arrowClass}"></div>
            <button class="phone-custom-btn">${choice.text}</button>
        `;

        wrapper.querySelector('.phone-custom-btn').onclick = () => {
            handleSearchAction(choice.id);
        };
        overlay.appendChild(wrapper);
    });
}

// --- ЛОГИКА ТАЙМЕРА ДЛЯ ПОИСКА ---
function startSearchTimer() {
    const timerBlock = document.getElementById('search-timer-block');
    timerBlock.style.display = 'flex'; // Показываем часы на экране
    
    // Берем начальное время из JSON (которое выдал Python)
    searchTimeSeconds = sceneData.current_time_left * 60;
    updateSearchTimerDisplay();

    // Каждую секунду отнимаем время
    searchTimerInterval = setInterval(() => {
        if (searchTimeSeconds > 0) {
            searchTimeSeconds--;
            updateSearchTimerDisplay();
        } else {
            clearInterval(searchTimerInterval);
            alert("Время вышло!");
            window.location.href = '/game?scene_id=2'; // Провал
        }
    }, 1000);
}

function updateSearchTimerDisplay() {
    const minutes = Math.floor(searchTimeSeconds / 60);
    let seconds = searchTimeSeconds % 60;
    if (seconds < 10) seconds = '0' + seconds;
    document.getElementById('game-timer-display').innerText = `${minutes}:${seconds}`;
}


async function handleSearchAction(actionId) {
    const response = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId })
    });
    
    const result = await response.json();

    if (result.status === 'win') {
        clearInterval(searchTimerInterval);
        window.location.href = '/tasks'; 
    } else {
        // 1. ВЫВОДИМ ТЕКСТ ВНИЗУ ЭКРАНА (ВМЕСТО АЛЕРТА)
        const dialogueElement = document.getElementById('main-dialogue');
        dialogueElement.innerText = result.text; 
        // Если хочешь эффект печатной машинки для этой фразы, используй: typeWriter(result.text);

        // 2. ЧИНИМ ВРЕМЯ (обрабатываем кортеж Питона [время, статус])
        let newTime;
        if (Array.isArray(result.time_left)) {
            newTime = result.time_left[0]; // Берем только число 35
        } else {
            newTime = result.time_left;
        }

        // Обновляем таймер, если время реально изменилось
        if (newTime < (searchTimeSeconds / 60)) {
            searchTimeSeconds = newTime * 60;
            updateSearchTimerDisplay();

            // Анимация штрафа
            const penalty = document.getElementById('game-penalty-popup');
            penalty.innerText = "-5:00 MIN";
            penalty.style.display = 'inline';
            setTimeout(() => { penalty.style.display = 'none'; }, 2000);
        }
    }
}

// ЗАПУСК ИГРЫ
loadScene();