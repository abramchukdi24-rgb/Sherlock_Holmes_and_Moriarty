let sceneData = null; // Тут будут лежать данные из JSON
let currentStep = 0;  // Номер текущей строчки текста
let currentState = 'intro_steps'; // В какой части JSON мы находимся

// 1. ЗАГРУЗКА ДАННЫХ
async function loadScene() {
    const response = await fetch('/api/scene?scene_id=1');
    sceneData = await response.json();
    render(); // Рисуем первый кадр
}

// 2. ОТРИСОВКА КАДРА (Раскадровка)
function render() {
    // Получаем данные текущего шага
    const step = sceneData[currentState][currentStep];

    // --- ЛОГИКА ФОНА ---
    // Если у шага есть свой фон — ставим его, если нет — берем общий фон сцены
    const bgFile = step.background || sceneData.background;
    document.getElementById('bg-layer').style.backgroundImage = `url('/static/images/backgrounds/${bgFile}')`;

    // --- ЛОГИКА ПЕРСОНАЖА (Как ты просила) ---
    const charImg = document.getElementById('char-img');
    if (step.character) {
        // Если в JSON есть имя (например, "moriarty"), показываем картинку
        charImg.src = `/static/images/characters/${step.character}.png`;
        charImg.style.display = 'block';
    } else {
        // Если character: null — прячем картинку персонажа
        charImg.style.display = 'none';
    }

    // --- ЛОГИКА ТЕКСТА ---
    document.getElementById('main-dialogue').innerText = step.text;
}

// 3. ЛОГИКА КЛИКА И ТЕЛЕФОНА
document.getElementById('click-overlay').addEventListener('click', () => {
    
    // ПРОВЕРКА: Закончилось ли Интро?
    if (currentState === 'intro_steps' && currentStep === sceneData.intro_steps.length - 1) {
        // Если в JSON есть триггер телефона — останавливаемся и показываем кнопку
        if (sceneData.phone_trigger) {
            showPhoneUI();
            return; // Дальше не листаем, пока не поднимут трубку
        }
    }

    // Листаем дальше внутри текущего блока
    if (currentStep < sceneData[currentState].length - 1) {
        currentStep++;
        render();
    } 
    // Если текущий блок кончился (например, диалог после телефона)
    else if (currentState === 'dialogue_steps') {
        // Проверяем, есть ли интерактив (выбор из 3 кнопок)
        if (sceneData.search_interact) {
            showChoicesUI();
        }
    }
});

// 4. ФУНКЦИЯ ДЛЯ ТЕЛЕФОНА
function showPhoneUI() {
    const choicesLayer = document.getElementById('choices-overlay');
    
    // Создаем кнопку "Поднять трубку" в твоем стиле
    choicesLayer.innerHTML = `
        <button class="btn btn-start" style="width: 400px;">
            ${sceneData.phone_trigger.prompt}
        </button>
    `;

    choicesLayer.querySelector('button').onclick = () => {
        choicesLayer.innerHTML = ""; // Убираем кнопку
        currentState = 'dialogue_steps'; // Переходим к разговору
        currentStep = 0;
        render(); // Показываем первую реплику после поднятия трубки
    };
}

// 5. ФУНКЦИЯ ДЛЯ ВЫБОРА (Стол, Шкаф, Дверь)
function showChoicesUI() {
    const choicesLayer = document.getElementById('choices-overlay');
    choicesLayer.innerHTML = ""; // Очищаем

    // Берем варианты из JSON (table, wardrobe, door)
    sceneData.search_interact.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-exit'; // Используем коричневый цвет для выбора
        btn.style.width = "500px";
        btn.style.marginBottom = "15px";
        btn.innerText = choice.text;
        
        btn.onclick = () => {
            alert(choice.result_text); // Пока просто алерт, потом сделаем переход
        };
        choicesLayer.appendChild(btn);
    });
}

// Запуск игры
loadScene();