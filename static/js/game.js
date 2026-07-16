let sceneData = null;
let currentStep = 0;
let currentState = 'intro_steps';

let isTyping = false;
let typingTimeout = null;

let searchTimerInterval = null;
let searchTimeSeconds = 0;

// 1. ЗАГРУЗКА ДАННЫХ
async function loadScene() {
    const response = await fetch('/api/scene?scene_id=1');
    sceneData = await response.json();
    render();
}

// 2. ГЛАВНЫЙ РЕНДЕР
function render() {
    const step = sceneData[currentState][currentStep];
    const gameScreen = document.getElementById('game-screen');

    if (step.is_title_screen) {
        gameScreen.classList.add('title-mode');
    } else {
        gameScreen.classList.remove('title-mode');
    }

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
}

// 3. ПЕЧАТНАЯ МАШИНКА
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
            typingTimeout = setTimeout(type, 25);
        } else {
            isTyping = false;
        }
    }
    type();
}

// 4. КЛИК ПО ЭКРАНУ
document.getElementById('click-overlay').addEventListener('click', () => {
    const step = sceneData[currentState][currentStep];

    if (isTyping) {
        clearTimeout(typingTimeout);
        document.getElementById('main-dialogue').innerText = step.text;
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
        if (currentState === 'intro_steps') {
            currentState = 'dialogue_steps';
            currentStep = 0;
            render();
        } 
        else if (currentState === 'dialogue_steps' && sceneData.search_interact) {
            showSearchUI();
        }
    }
});

// 5. ТЕЛЕФОН
function showPhoneUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = `
        <div class="phone-trigger-wrapper pos-phone">
            <div class="phone-arrow"></div>
            <button class="phone-custom-btn">${sceneData.phone_trigger.prompt}</button>
        </div>
    `;
    overlay.querySelector('.phone-custom-btn').onclick = () => {
        overlay.innerHTML = "";
        currentState = 'dialogue_steps';
        currentStep = 0;
        render();
    };
}

// 6. ПОИСК ЗАЦЕПОК
function showSearchUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = "";
    
    // Запуск таймера
    const timerBlock = document.getElementById('search-timer-block');
    timerBlock.style.display = 'flex';
    searchTimeSeconds = (sceneData.current_time_left || 40) * 60;
    
    searchTimerInterval = setInterval(() => {
        if (searchTimeSeconds > 0) {
            searchTimeSeconds--;
            updateSearchTimerDisplay();
        } else {
            clearInterval(searchTimerInterval);
            window.location.href = '/game'; 
        }
    }, 1000);

    sceneData.search_interact.choices.forEach(choice => {
        const wrapper = document.createElement('div');
        wrapper.className = `phone-trigger-wrapper pos-${choice.id}`;
        const arrowClass = (choice.id === 'door') ? 'phone-arrow arrow-right' : 'phone-arrow';
        wrapper.innerHTML = `<div class="${arrowClass}"></div><button class="phone-custom-btn">${choice.text}</button>`;
        wrapper.querySelector('.phone-custom-btn').onclick = () => handleSearchAction(choice.id);
        overlay.appendChild(wrapper);
    });
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
        // ПЕРЕДАЕМ ВРЕМЯ В СЛЕДУЮЩИЙ ФАЙЛ
        window.location.href = `/tasks?seconds=${searchTimeSeconds}`; 
    } else {
         document.getElementById('main-dialogue').innerText = result.text; 

        searchTimeSeconds = Math.max(0, searchTimeSeconds - 300);
        updateSearchTimerDisplay();

        // ВКЛЮЧАЕМ КРАСИВУЮ АНИМАЦИЮ ШТРАФА
        const penalty = document.getElementById('game-penalty-popup');
        penalty.innerText = "-5:00 MIN";
        penalty.classList.remove('penalty-animation'); // Сброс
        void penalty.offsetWidth; // Магия для перезапуска анимации
        penalty.classList.add('penalty-animation');
        
        setTimeout(() => { penalty.classList.remove('penalty-animation'); }, 2000);
    }
}

loadScene();